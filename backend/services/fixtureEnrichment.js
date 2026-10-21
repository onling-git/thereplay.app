const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
const { baselineSlugify: slugifyTeamName } = require('./coverageCatalog');

const FIXTURE_INCLUDE = 'participants;venue;league;season;round;stage;state;scores';
const DAY = 24 * 60 * 60 * 1000;
const INFO_FIELDS = [
  'starting_at', 'starting_at_timestamp', 'venue', 'referee', 'season', 'league',
  'round', 'stage', 'minute', 'time_added', 'period',
];
const IDENTITY_FIELDS = [
  'match_id', 'date', 'home_team', 'away_team', 'home_team_id', 'away_team_id',
  'home_team_slug', 'away_team_slug', 'status', 'status_code',
];
const present = value => value !== null && value !== undefined
  && !(typeof value === 'string' && !value.trim())
  && !(value instanceof Date && !Number.isFinite(value.getTime()));
const object = value => value && typeof value === 'object' && !Array.isArray(value)
  && !(value instanceof Date);

function sameTeam(existing, incoming, side) {
  const previousId = existing.teams?.[side]?.team_id ?? existing[`${side}_team_id`];
  const nextId = incoming.teams?.[side]?.team_id ?? incoming[`${side}_team_id`];
  return !present(previousId) || !present(nextId) || String(previousId) === String(nextId);
}

function mergeValues(existing, incoming) {
  if (!present(incoming)) return existing;
  if (!object(incoming)) return Array.isArray(incoming) && !incoming.length ? existing : incoming;
  const result = object(existing) ? { ...existing } : {};
  for (const [key, value] of Object.entries(incoming)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    const merged = mergeValues(result[key], value);
    if (merged !== undefined) result[key] = merged;
  }
  return result;
}

/**
 * Return a metadata-only patch (not a complete Match document).
 * Null/undefined/blank provider values never erase stored values; 0 and false do.
 * Existing fixture/team slugs remain canonical. Reports, events, lineups,
 * statistics, generation fields and sources are deliberately outside this API.
 */
function mergeFixtureMetadata(existing = {}, normalized = {}) {
  const source = normalized[Symbol.for('thereplay.fixtureMetadataSource')];
  if (source) {
    const copy = {
      ...normalized,
      teams: { ...normalized.teams },
      match_info: {
        ...normalized.match_info,
        ...(normalized.match_info?.season ? { season: { ...normalized.match_info.season } } : {}),
      },
    };
    normalized = normalizeMetadata(source, existing, () => copy);
  }
  const result = {};
  for (const field of IDENTITY_FIELDS) {
    const value = field.endsWith('_slug') && sameTeam(existing, normalized, field.split('_')[0]) && present(existing[field])
      ? existing[field] : mergeValues(existing[field], normalized[field]);
    if (present(value)) result[field] = value;
  }
  for (const field of INFO_FIELDS) {
    const value = mergeValues(existing.match_info?.[field], normalized.match_info?.[field]);
    if (present(value)) (result.match_info ||= {})[field] = value;
  }
  for (const side of ['home', 'away']) {
    for (const field of ['team_id', 'team_name', 'team_slug', 'logo']) {
      const old = existing.teams?.[side]?.[field];
      const value = field === 'team_slug' && sameTeam(existing, normalized, side) && present(old)
        ? old : mergeValues(old, normalized.teams?.[side]?.[field]);
      if (present(value)) {
        result.teams ||= {};
        result.teams[side] ||= {};
        result.teams[side][field] = value;
      }
    }
    const score = mergeValues(existing.score?.[side], normalized.score?.[side]);
    if (present(score)) (result.score ||= {})[side] = score;
  }
  for (const side of ['home', 'away']) {
    const slug = existing.teams?.[side]?.team_slug || existing[`${side}_team_slug`];
    if (sameTeam(existing, normalized, side) && present(slug)) {
      result[`${side}_team_slug`] = slug;
      result.teams ||= {};
      result.teams[side] ||= {};
      result.teams[side].team_slug = slug;
    }
  }
  for (const field of ['id', 'state', 'name', 'short_name', 'developer_name']) {
    const value = mergeValues(existing.match_status?.[field], normalized.match_status?.[field]);
    if (present(value)) (result.match_status ||= {})[field] = value;
  }
  return result;
}

function unwrap(value) {
  return value?.data ?? value;
}

// The shared full-match normalizer supplies display defaults. An enrichment
// response must not turn omitted scores, participants or status into real data.
function normalizeMetadata(fixture, existing, normalizeFixture) {
  const state = unwrap(fixture.state);
  const input = { ...fixture, ...(state ? { state } : {}) };
  if (fixture.starting_at == null && fixture.starting_at_timestamp == null) {
    input.starting_at = existing?.match_info?.starting_at ?? existing?.date;
  }
  const normalized = normalizeFixture(input);
  if (!normalized) throw new Error('Fixture normalization returned no metadata');
  normalized.match_info ||= {};
  for (const relation of ['league', 'season', 'round', 'stage', 'venue']) {
    const id = fixture[`${relation}_id`];
    if (present(id) && !present(normalized.match_info[relation]?.id)) {
      normalized.match_info[relation] = { ...normalized.match_info[relation], id };
    }
  }
  const participants = unwrap(fixture.participants);
  for (const [index, side] of ['home', 'away'].entries()) {
    const participant = Array.isArray(participants)
      ? participants.find(p => p?.meta?.location === side)
        ?? participants.filter(p => !p?.meta?.location)[index]
      : unwrap(side === 'home' ? fixture.localteam : fixture.visitorteam);
    const id = participant?.id ?? participant?.participant_id
      ?? fixture[side === 'home' ? 'localteam_id' : 'visitorteam_id'];
    const name = participant?.name || participant?.short_code;
    normalized.teams ||= {};
    normalized.teams[side] = {
      team_id: id, team_name: name, logo: participant?.image_path,
      team_slug: name ? slugifyTeamName(name) : undefined,
    };
    normalized[`${side}_team`] = name;
    normalized[`${side}_team_id`] = id;
    normalized[`${side}_team_slug`] = name ? slugifyTeamName(name) : undefined;
  }
  const hasState = state && Object.values(state).some(present);
  const hasStatusText = [state?.state, state?.name, state?.short_name, state?.developer_name,
    fixture.status?.name, fixture.time?.status].some(present);
  if (!hasStatusText) {
    delete normalized.status;
    delete normalized.status_code;
  }
  if (!hasState && !fixture.status && !fixture.time?.status) {
    delete normalized.status;
    delete normalized.status_code;
    normalized.match_status = present(fixture.state_id) ? { id: fixture.state_id } : {};
  } else if (hasState) {
    normalized.match_status = {
      ...state, state: state.state || state.developer_name || state.short_name || state.name,
    };
  }
  const season = unwrap(fixture.season);
  if (season?.is_current == null && season?.current == null && normalized.match_info?.season) {
    delete normalized.match_info.season.is_current;
  }
  normalized.score = {};
  const scores = unwrap(fixture.scores);
  if (Array.isArray(scores)) {
    const paired = scores.find(row => String(row.description).toLowerCase() === 'current'
      && (present(row.localteam_score) || present(row.visitorteam_score)))
      ?? scores.find(row => String(row.description).toLowerCase() === 'ft'
        && (present(row.localteam_score) || present(row.visitorteam_score)));
    for (const side of ['home', 'away']) {
      const value = paired?.[side === 'home' ? 'localteam_score' : 'visitorteam_score'];
      if (present(value) && Number.isFinite(Number(value))) normalized.score[side] = Number(value);
      const id = normalized.teams?.[side]?.team_id ?? existing?.teams?.[side]?.team_id;
      const candidates = scores.filter(row => row.score?.participant === side
        || (present(id) && String(row.participant_id) === String(id)));
      const row = candidates.find(s => String(s.description).toLowerCase() === 'current')
        ?? candidates.find(s => String(s.description).toLowerCase() === 'ft');
      if (present(row?.score?.goals) && Number.isFinite(Number(row.score.goals))) {
        normalized.score[side] = Number(row.score.goals);
      }
    }
  } else if (scores && typeof scores === 'object') {
    for (const [side, field] of [['home', 'localteam_score'], ['away', 'visitorteam_score']]) {
      if (present(scores[field]) && Number.isFinite(Number(scores[field]))) {
        normalized.score[side] = Number(scores[field]);
      }
    }
    const text = scores.ft_score ?? scores.fulltime ?? scores.final;
    const parsed = typeof text === 'string' && text.match(/^(\d+)\s*[-:]\s*(\d+)$/);
    if (parsed) normalized.score = { home: Number(parsed[1]), away: Number(parsed[2]) };
  }
  return normalized;
}

function incompleteFilter() {
  const fields = [
    'match_info.venue.name', 'match_info.venue.city_name', 'match_info.league.name',
    'match_info.season.name', 'match_info.round.name',
    'teams.home.team_id', 'teams.away.team_id', 'teams.home.team_name', 'teams.away.team_name',
  ];
  return { $or: [
    ...fields.map(field => ({ [field]: { $in: [null, ''] } })),
    { $and: ['state', 'name', 'short_name', 'developer_name'].map(field => ({
      [`match_status.${field}`]: { $in: [null, ''] },
    })) },
  ] };
}

function upcomingFilter(now, end) {
  const range = { $gte: now, $lte: end };
  return { $or: [
    { 'match_info.starting_at': range },
    { 'match_info.starting_at': null, date: range },
  ] };
}

function supportedOrMissingCompetition(policyFilter, coverage) {
  const teamIds = coverage.teamIds.flatMap(id => [Number(id), String(id)]);
  return { $or: [
    policyFilter,
    { $and: [
      { $or: ['teams.home.team_id', 'teams.away.team_id', 'home_team_id', 'away_team_id']
        .map(field => ({ [field]: { $in: teamIds } })) },
      ...['match_info.league.id', 'league.id', 'competition.id']
        .map(field => ({ [field]: { $in: [null, ''] } })),
    ] },
  ] };
}

function flatten(value, previous = {}, prefix = '', result = {}) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const old = previous?.[key];
    // Mongo cannot $set "league.id" when the stored league is explicitly null.
    // Replace that empty ancestor, while otherwise preserving unrelated fields
    // via leaf updates (notably all other Sportmonks source timestamps).
    if (object(child) && old !== undefined && !object(old)) result[path] = child;
    else if (object(child)) flatten(child, old, path, result);
    else if (present(child)) result[path] = child;
  }
  return result;
}

function isUpcoming(match, now, end) {
  const time = new Date(match.match_info?.starting_at ?? match.date).getTime();
  const state = match.match_status || {};
  return time >= now.getTime() && time <= end.getTime()
    && ![state.state, state.developer_name, state.short_name, state.name, match.status]
      .some(value => /^(FT|AET|FT_PEN|finished|ended|full[- ]?time|after penalties|after extra time|cancelled|canceled|abandoned)$/i.test(String(value || '')));
}

function supportedByCoverage(match, coverage) {
  const league = match.match_info?.league?.id ?? match.league?.id ?? match.competition?.id;
  const teams = [
    match.teams?.home?.team_id ?? match.home_team_id,
    match.teams?.away?.team_id ?? match.away_team_id,
  ];
  return coverage.competitionIds.map(Number).includes(Number(league))
    && teams.some(id => present(id) && coverage.teamIds.map(Number).includes(Number(id)));
}

/**
 * Refresh lightweight upcoming metadata, independently of kickoff changes.
 * All dependencies are optional injections, so dry runs/tests need no database
 * connection. dryRun still reads/fetches/normalizes, but performs zero writes.
 * Options: limit=40 (max 200), matchIds?: number[], daysAhead=14,
 * staleAfterMs=86400000, concurrency=2 (max 2), dryRun=false, now=new Date().
 * Injections: Match, Team, coveragePolicy (publicMatchFilter/getCoverage),
 * sportmonks (Axios-shaped get(path, params)), normalizeFixture.
 * Explicit IDs bypass freshness, not upcoming/coverage checks. Missing supported
 * fixtures are inserted only after fetched league/team coverage is verified.
 * Returns { ok, dryRun, scanned, selected, requested, enriched, updated,
 * inserted, teamsUpserted, skipped, errors: [{ match_id, code, message }] }.
 */
async function enrichUpcomingFixtures(options = {}) {
  const {
    limit = 40, matchIds, daysAhead = 14, staleAfterMs = DAY, concurrency = 2,
    dryRun = false, now: suppliedNow = new Date(),
    Match = require('../models/Match'), Team = require('../models/Team'),
    coveragePolicy = require('./coveragePolicy'),
    normalizeFixture = normaliseFixtureToMatchDoc,
  } = options;
  const stats = {
    ok: true, dryRun, scanned: 0, selected: 0, requested: 0, enriched: 0,
    updated: 0, inserted: 0, teamsUpserted: 0, skipped: 0, errors: [],
  };
  const fail = (match_id, code, message) => {
    stats.ok = false;
    stats.errors.push({ match_id, code, message });
  };
  const now = new Date(suppliedNow);
  const bound = Math.min(200, Math.max(0, Math.floor(Number(limit))));
  if (!Number.isFinite(bound) || !Number.isFinite(now.getTime())
    || !Number.isFinite(Number(daysAhead)) || Number(daysAhead) <= 0
    || !Number.isFinite(Number(staleAfterMs)) || Number(staleAfterMs) < 0
    || !Number.isFinite(Number(concurrency)) || Number(concurrency) < 1
    || (matchIds !== undefined && (!Array.isArray(matchIds)
      || matchIds.some(id => !Number.isSafeInteger(Number(id)) || Number(id) <= 0)))) {
    fail(null, 'INVALID_OPTIONS', 'Invalid fixture enrichment options');
    return stats;
  }
  if (!bound || (Array.isArray(matchIds) && !matchIds.length)) return stats;
  const end = new Date(now.getTime() + Number(daysAhead) * DAY);
  let provider = options.sportmonks;
  if (!provider) {
    if (!process.env.SPORTMONKS_API_KEY) {
      fail(null, 'PROVIDER_UNAVAILABLE', 'SPORTMONKS_API_KEY is not configured');
      return stats;
    }
    provider = require('../utils/sportmonks');
  }
  let records;
  let coverage;
  let ids;
  try {
    const policyFilter = await coveragePolicy.publicMatchFilter();
    coverage = await coveragePolicy.getCoverage();
    ids = matchIds && [...new Set(matchIds.map(Number))].slice(0, bound);
    const selection = ids ? { match_id: { $in: ids } } : { $or: [
      incompleteFilter(),
      { 'sources.sportmonks.metadata_fetched_at': null },
      { 'sources.sportmonks.metadata_fetched_at': { $lte: new Date(now.getTime() - Number(staleAfterMs)) } },
    ] };
    records = await Match.find({ $and: [
      supportedOrMissingCompetition(policyFilter, coverage), upcomingFilter(now, end), selection,
    ] }).sort({ 'sources.sportmonks.metadata_fetched_at': 1, 'match_info.starting_at': 1 })
      .limit(bound).lean();
    stats.scanned = records.length;
  } catch (error) {
    fail(null, error.code || 'SELECTION_FAILED', error.message);
    return stats;
  }
  const byId = new Map(records.map(record => [Number(record.match_id), record]));
  const work = ids || [...byId.keys()];
  stats.selected = work.length;
  let cursor = 0;
  async function processMatch(id) {
    let existing = byId.get(id);
    let fixture;
    stats.requested++;
    try {
      const response = await provider.get(`/fixtures/${id}`, { include: FIXTURE_INCLUDE });
      fixture = response?.data?.data ?? response?.data;
      if (!fixture || Number(fixture.id) !== id) {
        fail(id, 'INVALID_PROVIDER_RESPONSE', 'Provider returned no matching fixture');
        return;
      }
    } catch (error) {
      fail(id, 'PROVIDER_REQUEST_FAILED', `Sportmonks fixture request failed${error.response?.status ? ` (HTTP ${error.response.status})` : ''}`);
      return;
    }
    try {
      // An explicit ID may not yet be stored (or may have sparse coverage data).
      // Do not replace an existing unscoped record with a freshly defaulted doc.
      if (!existing) existing = await Match.findOne({ match_id: id }).lean();
      const normalized = normalizeMetadata(fixture, existing, normalizeFixture);
      const merged = mergeFixtureMetadata(existing || {}, normalized);
      if (!isUpcoming(merged, now, end)
        || !supportedByCoverage(merged, coverage)
        || (!supportedByCoverage(existing || {}, coverage)
          && !supportedByCoverage(normalized, coverage))) {
        stats.skipped++;
        return;
      }
      stats.enriched++;
      if (dryRun) return;
      for (const side of ['home', 'away']) {
        const team = merged.teams?.[side];
        if (!present(team?.team_id) || !present(team.team_name)) continue;
        const teamId = Number(team.team_id);
        if (!Number.isSafeInteger(teamId) || teamId <= 0) continue;
        const storedTeam = await Team.findOne({ id: teamId }).lean();
        const slug = storedTeam?.slug || slugifyTeamName(team.team_name);
        await Team.updateOne({ id: teamId }, {
          $set: {
            name: team.team_name,
            ...(present(team.logo) ? { image_path: team.logo } : {}),
          },
          $setOnInsert: { id: teamId, slug },
        }, { upsert: true, runValidators: true });
        stats.teamsUpserted++;
        const unchanged = sameTeam(existing || {}, normalized, side);
        if (!unchanged || !present(existing?.teams?.[side]?.team_slug)) merged.teams[side].team_slug = slug;
        if (!unchanged || !present(existing?.[`${side}_team_slug`])) merged[`${side}_team_slug`] = slug;
      }
      const set = flatten({
        ...merged, sources: { sportmonks: { metadata_fetched_at: now } },
      }, existing || {});
      // updateOne bypasses finished-match save/findOneAndUpdate hooks. strict:false
      // is required for the additive source timestamp on older Match schemas.
      await Match.updateOne({ match_id: id }, { $set: set }, {
        upsert: true, runValidators: true, strict: false,
      });
      if (existing) stats.updated++;
      else stats.inserted++;
    } catch (error) {
      fail(id, 'ENRICHMENT_FAILED', error.message);
    }
  }
  await Promise.all(Array.from({ length: Math.min(2, Math.floor(Number(concurrency)), work.length) }, async () => {
    while (cursor < work.length) {
      const id = work[cursor++];
      await processMatch(id);
    }
  }));
  return stats;
}

module.exports = { enrichUpcomingFixtures, mergeFixtureMetadata, FIXTURE_INCLUDE };
