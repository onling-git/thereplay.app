const { randomUUID } = require('node:crypto');
const policy = require('./coveragePolicy');
const { fetchSportmonksPages } = require('../utils/sportmonksPages');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
const { mergeFixtureMetadata, FIXTURE_INCLUDE } = require('./fixtureEnrichment');
const { baselineSlugify } = require('./coverageCatalog');
const Config = require('../models/CoverageConfig');
const Match = require('../models/Match');
const Team = require('../models/Team');
const DAY = 86400000;
const LEASE_MS = 30 * 60000;

function metadataUpdate(existing, fixture, teams, runId, now) {
  const normalized = normaliseFixtureToMatchDoc(fixture);
  if (!normalized) throw new Error(`Cannot normalize fixture ${fixture.id}`);
  for (const side of ['home', 'away']) {
    const team = teams.get(Number(normalized.teams?.[side]?.team_id));
    if (team?.slug) {
      normalized.teams[side].team_slug = team.slug;
      normalized[`${side}_team_slug`] = team.slug;
    }
  }
  const patch = mergeFixtureMetadata(existing || {}, normalized);
  // Dotted updates retain lineups, report flags and richer nested fields.
  const set = {};
  function flatten(value, prefix = '', previous = existing) {
    for (const [key, item] of Object.entries(value)) {
      const field = prefix ? `${prefix}.${key}` : key;
      if (item && typeof item === 'object' && !(item instanceof Date) && !Array.isArray(item)) {
        if (previous?.[key] === null) set[field] = item;
        else flatten(item, field, previous?.[key]);
      }
      else if (item !== undefined) set[field] = item;
    }
  }
  flatten(patch);
  for (const side of ['home', 'away']) {
    const team = teams.get(Number(normalized.teams?.[side]?.team_id));
    if (team?.slug) {
      if (set[`teams.${side}`]) set[`teams.${side}`].team_slug = team.slug;
      else if (set.teams) set.teams[side].team_slug = team.slug;
      else set[`teams.${side}.team_slug`] = team.slug;
      set[`${side}_team_slug`] = team.slug;
    }
  }
  const source = { metadata_fetched_at: now, last_fetched_at: now,
    last_fetched_with_include: FIXTURE_INCLUDE, maintenance_refresh_id: runId };
  if (existing?.sources === null) set.sources = { sportmonks: source };
  else if (existing?.sources?.sportmonks === null) set['sources.sportmonks'] = source;
  else for (const [key, value] of Object.entries(source)) set[`sources.sportmonks.${key}`] = value;
  return set;
}

async function refreshCoveredTeamSnapshots() {
  const coverage = await policy.getCoverage();
  const result = await require('../utils/teamCacheUtils').batchRefreshTeamCache(
    coverage.teams.map(team => team.slug), 'coverage-refresh', { concurrency: 4, delayMs: 50 }
  );
  if (result.failed) throw new Error(`Team snapshot refresh failed: ${JSON.stringify(result.errors)}`);
  return { clubs: result.total, successful: result.successful, updated: result.updated };
}

async function getCoverageDataStatus() {
  const coverage = await policy.getCoverage();
  const now = new Date();
  const leagues = await require('../models/League').find({ id: { $in: coverage.leagueIds } }).lean();
  const teams = await Team.find({ id: { $in: coverage.teamIds } })
    .select('id name slug image_path venue profile_synced_at cache_metadata next_match last_match').lean();
  const tables = leagues.length ? await require('../models/Standing').find({
    $or: leagues.map(league => ({ league_id: league.id, season_id: league.current_season_id }))
  }).lean() : [];
  const fixtures = await Match.find({ $and: [
    policy.matchFilterForCoverage(coverage),
    { 'match_info.starting_at': { $gte: now, $lte: new Date(now.getTime() + 14 * DAY) } }
  ] }).select('match_id match_info teams sources').lean();
  const missingClubFields = teams.map(team => ({
    id: team.id, name: team.name,
    missing: ['image_path', 'venue.name', 'profile_synced_at'].filter(field =>
      !field.split('.').reduce((value, key) => value?.[key], team))
  })).filter(team => team.missing.length);
  return {
    checked_at: now, clubs: teams.length,
    missing_club_fields: missingClubFields,
    stale_club_profiles: teams.filter(team => !team.profile_synced_at || now - new Date(team.profile_synced_at) > 7 * 3600000).map(team => team.id),
    stale_hub_snapshots: teams.filter(team => !team.cache_metadata?.cached_at || now - new Date(team.cache_metadata.cached_at) > 30 * 60000).map(team => team.id),
    standings: leagues.map(league => {
      const table = tables.filter(table => table.league_id === league.id)
        .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))[0];
      return { league_id: league.id, name: league.name, season_id: league.current_season_id,
        rows: table?.table?.length || 0, last_updated: table?.last_updated || null };
    }),
    upcoming_fixtures: fixtures.length,
    fixtures_missing_metadata: fixtures.filter(match => !match.match_info?.venue?.name || !match.match_info?.league?.name
      || !match.match_info?.season?.name || !match.teams?.home?.team_name || !match.teams?.away?.team_name).map(match => match.match_id)
  };
}

async function refreshCoverageData({ daysBack = 7, daysAhead = 14 } = {}) {
  for (const [key, value] of Object.entries({ daysBack, daysAhead })) {
    if (!Number.isInteger(value) || value < 1 || value > 120) {
      throw Object.assign(new Error(`${key} must be an integer from 1 to 120`), { status: 400 });
    }
  }
  const now = new Date();
  const runId = randomUUID();
  const status = { run_id: runId, started_at: now, finished_at: null, ok: false, days_back: daysBack, days_ahead: daysAhead, fixtures: 0, errors: [] };
  const lease = await Config.findOneAndUpdate({
    _id: 'public-coverage', initialized: true,
    $or: [{ data_refresh_lease_until: null }, { data_refresh_lease_until: { $lt: now } }]
  }, { $set: { data_refresh_lease_until: new Date(now.getTime() + LEASE_MS), data_refresh_status: status } }, { new: true }).lean();
  if (!lease) throw Object.assign(new Error('Coverage is uninitialized or a data refresh is already running'), { status: 409 });
  const owner = { _id: 'public-coverage', 'data_refresh_status.run_id': runId };
  async function renew() {
    const result = await Config.updateOne(owner, {
      $set: { data_refresh_lease_until: new Date(Date.now() + LEASE_MS) }
    });
    if (!result.matchedCount) throw new Error('Coverage refresh lease was lost');
  }
  try {
    const coverage = await policy.getCoverage();
    const competitions = new Set(coverage.competitionIds);
    const clubs = new Set(coverage.teamIds);
    const teams = new Map((await Team.find({ id: { $in: coverage.teamIds } }).lean()).map(team => [Number(team.id), team]));
    const start = new Date(now.getTime() - daysBack * DAY);
    const end = new Date(now.getTime() + daysAhead * DAY);
    // Small date windows keep provider responses and runtime bounded.
    if (competitions.size && clubs.size) for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 7 * DAY)) {
      await renew();
      const last = new Date(Math.min(end.getTime(), cursor.getTime() + 6 * DAY));
      const fromDate = cursor.toISOString().slice(0, 10);
      const toDate = last.toISOString().slice(0, 10);
      try {
        const fixtures = await fetchSportmonksPages(`/fixtures/between/${fromDate}/${toDate}`, {
          include: FIXTURE_INCLUDE, filters: `fixtureLeagues:${coverage.competitionIds.join(',')}`
        });
        for (const fixture of fixtures) {
          const participants = fixture.participants || [];
          if (!competitions.has(Number(fixture.league_id)) || !participants.some(team => clubs.has(Number(team.id)))) continue;
          try {
            if (!participants.some(team => team.meta?.location === 'home') || !participants.some(team => team.meta?.location === 'away')) {
              throw new Error('Missing confirmed home/away participants');
            }
            for (const participant of participants) {
              if (!teams.has(Number(participant.id))) {
                const team = await Team.findOneAndUpdate({ id: Number(participant.id) }, {
                  $setOnInsert: {
                    id: Number(participant.id), name: participant.name,
                    slug: baselineSlugify(participant.name) || `team-${participant.id}`,
                    image_path: participant.image_path, country_id: participant.country_id
                  }
                }, { upsert: true, new: true }).lean();
                teams.set(Number(team.id), team);
              }
            }
            const existing = await Match.findOne({ match_id: fixture.id }).lean();
            await Match.updateOne({ match_id: fixture.id }, {
              $set: metadataUpdate(existing, fixture, teams, runId, new Date())
            }, { upsert: true, runValidators: true, setDefaultsOnInsert: false });
            status.fixtures++;
          } catch (error) {
            status.errors.push({ fixture_id: fixture.id, message: error.message });
          }
        }
      } catch (error) {
        status.errors.push({ from: fromDate, to: toDate, message: error.message });
      }
    }
    await renew();
    // Cups often have no league table; only domestic league membership defines tables.
    status.standings = await require('./standingsService').syncMultipleLeagues(coverage.leagueIds, 200);
    status.standings = status.standings.map(result => ({
      league_id: result.league_id, success: result.success,
      rows: result.data?.table?.length, error: result.error
    }));
    for (const result of status.standings) if (!result.success) status.errors.push({ league_id: result.league_id, message: result.error || 'Standings unavailable' });
    await renew();
    status.snapshots = await refreshCoveredTeamSnapshots();
    status.ok = status.errors.length === 0;
  } catch (error) {
    status.errors.push({ message: error.message });
  } finally {
    status.finished_at = new Date();
    await Config.updateOne(owner, { $set: { data_refresh_status: status, data_refresh_lease_until: null } });
  }
  if (!status.ok) {
    const error = Object.assign(new Error('Coverage data refresh incomplete; inspect coverage refresh status'), { status: 502, result: status });
    console.error('[coverage-data]', JSON.stringify(status.errors));
    throw error;
  }
  return status;
}

module.exports = { refreshCoverageData, refreshCoveredTeamSnapshots, getCoverageDataStatus, metadataUpdate };
