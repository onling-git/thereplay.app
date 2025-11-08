#!/usr/bin/env node
// scripts/seed_season_matches.js
// Fetch and upsert all fixtures for a season (includes events, lineups, player ratings, commentary where available)
// Usage:
//   node scripts/seed_season_matches.js [--season=SEASON_ID] [--limit=N] [--dry] [--throttle=ms] [--mongo="mongodb://..."]

const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}
const { get: smGet } = require('../utils/sportmonks');
const connectDB = require('../db/connect');
const Match = require('../models/Match');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
const argv = require('minimist')(process.argv.slice(2));

const seasonId = argv.season ? String(argv.season) : process.env.SPORTMONKS_SEASON_ID || null;
const limit = Number(argv.limit) || 0;
const dry = !!argv.dry;
const dump = !!argv.dump;
const throttleMs = Number(argv.throttle) || 200;
const mongoFromArg = argv.mongo || argv.MONGO || null;
const fixtureArg = argv.fixture || argv.id || null;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// NOTE: We intentionally do NOT call team-level squad/player endpoints here.
// We prefer fixture-level lineups via GET /fixtures/{id}?include=lineups as the canonical source.

// Fetch fixture-by-id lineups (prefer detailedposition) and return { home:[], away:[] } or null
async function fetchFixtureLineups(fixtureId) {
  if (!fixtureId) return null;
  try {
    // Use the fixture-by-id endpoint with include=lineups (provider may include detailedposition inside)
    const res = await smGet(`fixtures/${fixtureId}`, { include: 'lineups' });
    const payload = res?.data?.data || res?.data || null;
    if (!payload) return null;
    // handle payload where lineups is an object keyed by side (home/away)
    let rawLineups = payload.lineups?.data || payload.lineups || payload.lineup?.data || payload.lineup || [];
    const home = [];
    const away = [];

    // If lineups is an object with home/away keys, convert to groups
    if (rawLineups && !Array.isArray(rawLineups) && typeof rawLineups === 'object') {
      const asArray = [];
      if (rawLineups.home || rawLineups.home_team) asArray.push(Object.assign({}, rawLineups.home || rawLineups.home_team, { __side: 'home' }));
      if (rawLineups.away || rawLineups.away_team) asArray.push(Object.assign({}, rawLineups.away || rawLineups.away_team, { __side: 'away' }));
      rawLineups = asArray;
    }

    if (!Array.isArray(rawLineups) || !rawLineups.length) return null;

    // Build robust home/away id sets from payload (filter out falsy/undefined)
    const collectIds = (vals) => {
      const out = new Set();
      for (const v of vals || []) {
        if (v === undefined || v === null) continue;
        const s = String(v);
        if (!s || s === 'undefined') continue;
        out.add(s);
      }
      return out;
    };
    const homeIds = collectIds([payload.localteam_id, payload.home_team_id, payload.localteam?.data?.id, payload.home_team?.data?.id, payload.localteam?.id, payload.home_team?.id, payload.localteam, payload.home_team]);
    const awayIds = collectIds([payload.visitorteam_id, payload.away_team_id, payload.visitorteam?.data?.id, payload.away_team?.data?.id, payload.visitorteam?.id, payload.away_team?.id, payload.visitorteam, payload.away_team]);

    // If the lineup array is flat (each item is a player entry), handle directly
    const first = rawLineups[0];
    const looksLikePlayerEntries = first && (first.player_id || first.player_name || first.player?.id || first.id);
    const seen = new Set();
    function toKey(p) {
      if (!p) return '';
      const v = p.player_id ?? p.id ?? p.player?.id ?? p.player_name ?? p.name ?? null;
      return String(v ?? '');
    }

    if (looksLikePlayerEntries) {
      // If we don't have explicit home/away ids from payload, derive from ordering of team_ids in the lineup array
      let derivedHomeId = null;
      let derivedAwayId = null;
      if (homeIds.size === 0 && awayIds.size === 0) {
        const seenOrder = [];
        for (const r of rawLineups) {
          const t = String(r?.team_id ?? r?.team?.id ?? '');
          if (!t) continue;
          if (!seenOrder.includes(t)) seenOrder.push(t);
        }
        if (seenOrder.length >= 2) {
          derivedHomeId = seenOrder[0];
          derivedAwayId = seenOrder[1];
        }
      }

      for (let raw of rawLineups) {
        if (raw?.player && (typeof raw.player === 'object')) raw = raw.player;
        const playerId = raw?.player_id ?? raw?.player?.id ?? raw?.id ?? null;
        const playerName = raw?.player?.name || raw?.player_name || raw?.name || null;
        const jersey = raw?.number ?? raw?.jersey_number ?? raw?.jersey ?? null;
        const positionId = raw?.position_id ?? raw?.position ?? raw?.role ?? null;
        const teamId = raw?.team_id ?? raw?.team?.id ?? raw?.team?.team_id ?? null;
        const key = toKey(raw) || `${playerName || ''}::${jersey || ''}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const entry = { player_id: playerId ?? null, player_name: playerName ?? null, jersey_number: jersey ?? null, position_id: positionId ?? null, team_id: teamId ?? null };
        const sTeam = teamId != null ? String(teamId) : null;
        if (sTeam) {
          if (homeIds.size && homeIds.has(sTeam)) home.push(entry);
          else if (awayIds.size && awayIds.has(sTeam)) away.push(entry);
          else if (!homeIds.size && !awayIds.size && derivedHomeId && derivedAwayId) {
            if (sTeam === derivedHomeId) home.push(entry);
            else if (sTeam === derivedAwayId) away.push(entry);
            else away.push(entry);
          } else {
            // team_id present but not mappable; assign conservatively to away
            away.push(entry);
          }
        } else {
          // no team_id on player entry: try group side hint, else assign to away
          if (String(group?.__side || group?.type || group?.side || '').toLowerCase().includes('home')) home.push(entry);
          else if (String(group?.__side || group?.type || group?.side || '').toLowerCase().includes('away')) away.push(entry);
          else away.push(entry);
        }
      }
      return { home, away };
    }

    for (const group of rawLineups) {
      // collect many possible player arrays and nested shapes
      const candidates = [
        group.detailedposition, group.detailed_position, group.detailedPosition,
        group.players, group.players?.data, group.players?.nodes, group.lineup, group.starters, group.substitutes, group.bench, group.squad, group.all_players
      ];
      const playersSource = candidates.find(a => Array.isArray(a) && a.length) || null;
      if (!Array.isArray(playersSource)) continue;

      for (let raw of playersSource) {
        // unwrap nested wrappers like { player: { ... } } or { player: { data: {...} } }
        if (raw?.player && (typeof raw.player === 'object')) raw = raw.player;
        if (raw?.data && raw.data?.player) raw = raw.data.player;

        const playerId = raw?.player_id ?? raw?.id ?? raw?.player?.id ?? raw?.player_id ?? null;
        const playerName = raw?.player?.name || raw?.name || raw?.player_name || raw?.fullname || null;
        const jersey = raw?.number ?? raw?.jersey_number ?? raw?.jersey ?? null;
        const positionId = raw?.position_id ?? raw?.position ?? raw?.role ?? null;
        const teamId = raw?.team_id ?? raw?.team?.id ?? raw?.player?.team_id ?? raw?.player?.team?.id ?? group?.team_id ?? group?.team?.id ?? null;

        const key = toKey(raw);
        if (!key || seen.has(key)) {
          // if no unique key, still allow multiple entries, but protect exact duplicates by name+jersey
          const altKey = `${playerName || ''}::${jersey || ''}`;
          if (seen.has(altKey)) continue;
          seen.add(altKey);
        } else {
          seen.add(key);
        }

  const entry = { player_id: playerId ?? null, player_name: playerName ?? null, jersey_number: jersey ?? null, position_id: positionId ?? null, team_id: sTeam ?? null };

        // home/away ids from payload (support many field name variants)
        const homeCandidates = [payload.localteam_id, payload.home_team_id, payload.localteam?.data?.id, payload.home_team?.data?.id, payload.localteam, payload.home_team];
        const awayCandidates = [payload.visitorteam_id, payload.away_team_id, payload.visitorteam?.data?.id, payload.away_team?.data?.id, payload.visitorteam, payload.away_team];
        const sTeam = teamId != null ? String(teamId) : null;
        let assigned = false;
        if (sTeam) {
          if (homeCandidates.map(String).includes(sTeam)) { home.push(entry); assigned = true; }
          else if (awayCandidates.map(String).includes(sTeam)) { away.push(entry); assigned = true; }
        }

        if (!assigned) {
          // use group side hint if present
          if (group.__side === 'home' || String(group.type || '').toLowerCase().includes('home') || String(group.side || '').toLowerCase().includes('home')) { home.push(entry); }
          else if (group.__side === 'away' || String(group.type || '').toLowerCase().includes('away') || String(group.side || '').toLowerCase().includes('away')) { away.push(entry); }
          else {
            // if still unknown, push to both sides? push to away to avoid overwriting home-first preference
            away.push(entry);
          }
        }
      }
    }
    return { home, away };
  } catch (e) {
    return null;
  }
}

function mapToModelShape(norm, provider) {
  // norm: output from normaliseFixtureToMatchDoc
  // provider: raw sportmonks fixture payload
  const m = {};
  // match_info
  m.match_id = Number(norm.match_id || norm.id || norm.match_id || norm.id);
  // prefer the normalized date from norm (already a Date if normaliser ran)
  const { parseProviderDate } = require('../utils/normaliseFixture');
  const normDate = norm && norm.date ? (norm.date instanceof Date ? norm.date : parseProviderDate(norm.date)) : null;
  const provDate = provider && provider.starting_at ? parseProviderDate(provider.starting_at) : null;
  const finalDate = normDate || provDate || null;
  const finalTs = finalDate ? Math.floor(new Date(finalDate).getTime() / 1000) : null;

  m.match_info = {
    starting_at: finalDate,
    starting_at_timestamp: finalTs,
    venue: (provider && (provider.venue?.data?.name || provider.venue?.name || provider.venue)) || '',
    referee: (provider && (provider.referee?.data?.name || provider.referee?.name || provider.referee)) || '',
    season: (provider && (provider.season?.data?.name || provider.season?.name || provider.season)) || (norm.participants && norm.participants.season) || '',
    league: (provider && (provider.league?.data?.name || provider.league?.name || provider.league)) || norm.league || ''
  };
  // copy live minute/added time into match_info if available
  // minute: prefer normalized value, then provider.time minute/current
  if (norm.minute != null) m.match_info.minute = norm.minute;
  else if (provider && provider.time) m.match_info.minute = Number(provider.time.minute ?? provider.time.current ?? null);

  // time_added: prefer normalized object, otherwise attempt to extract from provider.time or provider.periods
  if (norm.time_added && typeof norm.time_added === 'object') {
    m.match_info.time_added = Object.assign({}, m.match_info.time_added || {}, norm.time_added);
  } else if (provider && provider.time && (provider.time.added_time != null || provider.time.added_first_half != null || provider.time.added_second_half != null)) {
    m.match_info.time_added = { first_half: provider.time.added_first_half ?? null, second_half: provider.time.added_second_half ?? provider.time.added_time ?? null };
  } else if (provider && Array.isArray(provider.periods) && provider.periods.length) {
    // provider.periods may be array or object
    const periods = provider.periods?.data || provider.periods;
    if (Array.isArray(periods) && periods.length) {
      const first = periods.find(p => p && (p.type_id === 1 || (p.description || '').toLowerCase().includes('1st')));
      const second = periods.find(p => p && (p.type_id === 2 || (p.description || '').toLowerCase().includes('2nd')));
      m.match_info.time_added = { first_half: first?.time_added ?? null, second_half: second?.time_added ?? null };
    }
  }

  // teams
  m.teams = {
    home: { team_name: norm.home_team || norm.home || (provider && provider.home_team?.name) || '', team_id: norm.home_team_id ?? provider?.home_team_id ?? provider?.localteam_id ?? null, team_slug: norm.home_team_slug || '' },
    away: { team_name: norm.away_team || norm.away || (provider && provider.away_team?.name) || '', team_id: norm.away_team_id ?? provider?.away_team_id ?? provider?.visitorteam_id ?? null, team_slug: norm.away_team_slug || '' }
  };

  // score, events, player_stats
  m.score = norm.score || { home: 0, away: 0 };
  m.events = Array.isArray(norm.events) ? norm.events : (provider?.events?.data || provider?.events || []);
  // player_stats and participants come from the normalizer when available
  m.player_stats = norm.player_stats || [];
  m.participants = norm.participants || [];
  m.player_ratings = norm.player_ratings || [];
  // lineup: prefer normalized lineup, otherwise provider lineups if any
  m.lineup = { home: [], away: [] };
  if (norm.lineup && (Array.isArray(norm.lineup.home) || Array.isArray(norm.lineup.away))) {
    m.lineup.home = norm.lineup.home || [];
    m.lineup.away = norm.lineup.away || [];
  } else if (provider) {
    // Prefer detailedposition within lineups when available: provider.lineups.data[].detailedposition
    const rawLineups = provider.lineups?.data || provider.lineups || provider.lineup?.data || provider.lineup || [];
    if (Array.isArray(rawLineups) && rawLineups.length) {
      for (const group of rawLineups) {
        // SportMonks sometimes nests detailedposition inside each lineup group
        const detailed = group.detailedposition || group.detailed_position || group.detailedPosition || null;
        const playersSource = Array.isArray(detailed) && detailed.length ? detailed : (Array.isArray(group.players) ? group.players : null);
        const teamIsHome = group.team_id == provider.localteam_id || group.team_id == provider.home_team_id || String(group.type || '').toLowerCase().includes('home');
        const arr = (teamIsHome ? m.lineup.home : m.lineup.away);
        if (Array.isArray(playersSource)) {
          for (const p of playersSource) {
            // detailedposition entries may have: player_id, name, position, position_id, number, jersey_number
            const playerId = p.player_id ?? p.player?.id ?? p.player_id ?? p.id ?? p.player?.player_id ?? null;
            const playerName = p.player?.name || p.name || p.player_name || p.fullname || null;
            const jersey = p.number ?? p.jersey_number ?? p.jersey ?? null;
            const positionId = p.position_id ?? p.position ?? p.role ?? null;
            arr.push({ player_id: playerId, player_name: playerName, jersey_number: jersey, position_id: positionId, type_id: p.type_id ?? null, team_id: group.team_id ?? null, rating: p.rating ?? null });
          }
        }
      }
    }
  }

  // match_status - prefer normalized provider state, then provider.state/status/time; ensure finished state when score looks final
  if (norm.match_status && Object.keys(norm.match_status).length) {
    m.match_status = norm.match_status;
  } else if (provider && provider.state && Object.keys(provider.state).length) {
    m.match_status = provider.state;
  } else if (provider && provider.time) {
    m.match_status = {
      id: provider.state?.id ?? null,
      state: provider.time?.status ?? provider.status?.name ?? '',
      name: provider.time?.status ?? provider.status?.name ?? '',
      short_name: provider.time?.status_code ?? provider.status?.short_name ?? '',
      developer_name: provider.status?.developer_name ?? provider.state?.developer_name ?? ''
    };
  } else {
    m.match_status = { id: null, state: '', name: '', short_name: '', developer_name: '' };
  }

  // If the score looks final and no status is provided, set finished
  try {
    const home = m.score?.home ?? 0;
    const away = m.score?.away ?? 0;
    const statusName = String(m.match_status?.state || m.match_status?.name || '').toLowerCase();
    if ((home || away) && !statusName) {
      m.match_status.state = 'finished';
      m.match_status.name = 'finished';
      m.match_status.short_name = 'FT';
    }
  } catch (e) {}

  // POTM + reports
  m.player_of_the_match = norm.player_of_the_match || '';
  m.potm = norm.potm || { home: { player: '', rating: null, reason: '', source: '' }, away: { player: '', rating: null, reason: '', source: '' } };
  m.reports = norm.reports || { home: '', away: '', generated_at: null, model: '' };

  return m;
}

function inferLineupsFromEvents(doc) {
  const events = Array.isArray(doc.events) ? doc.events : [];
  const homeName = (doc.teams && doc.teams.home && String(doc.teams.home.team_name).toLowerCase()) || '';
  const awayName = (doc.teams && doc.teams.away && String(doc.teams.away.team_name).toLowerCase()) || '';

  const playerTeams = new Map(); // name -> Set('home'|'away')
  const normalize = (s) => String(s || '').trim();

  for (const e of events) {
    const p = normalize(e.player);
    if (!p) continue;
    let which = null;
    if (e.team != null && (String(e.team) === String(doc.teams.home.team_id) || String(e.team) === String(doc.teams.away.team_id))) {
      if (String(e.team) === String(doc.teams.home.team_id)) which = 'home'; else which = 'away';
    } else if (e.team && String(e.team).toLowerCase().includes(homeName)) {
      which = 'home';
    } else if (e.team && String(e.team).toLowerCase().includes(awayName)) {
      which = 'away';
    }
    if (!playerTeams.has(p)) playerTeams.set(p, new Set());
    if (which) playerTeams.get(p).add(which);
  }

  const home = [];
  const away = [];
  const unassigned = [];

  for (const [name, teams] of playerTeams.entries()) {
    if (teams.has('home') && !teams.has('away')) home.push({ player_name: name });
    else if (teams.has('away') && !teams.has('home')) away.push({ player_name: name });
    else unassigned.push(name);
  }

  // evenly distribute unassigned players between teams
  for (let i = 0; i < unassigned.length; i++) {
    const name = unassigned[i];
    if (home.length <= away.length) home.push({ player_name: name }); else away.push({ player_name: name });
  }

  return { home, away };
}

async function fetchFixturesForSeason(season) {
  // Try multiple endpoints for portability: /fixtures/season/{season} or /fixtures/rounds/season/{season}
  const paths = [`/fixtures/season/${season}`, `/fixtures/rounds/season/${season}`, `/fixtures/competition/${season}`];
  for (const p of paths) {
    try {
      // adaptive includes: start from the provider-supported tokens you supplied (rates removed)
      const preferIncludes = [
        'events','participants','lineups.detailedposition','periods','comments','scores','timeline','formations','group','league','season','venue','state','referees'
      ];
      let tokens = [...preferIncludes];
      let lastErr = null;
      while (true) {
        const includeStr = tokens.join(';');
        try {
          const res = await smGet(p, { include: includeStr });
          const payload = res?.data?.data || res?.data;
          if (Array.isArray(payload)) return payload;
          if (payload && Array.isArray(payload.data)) return payload.data;
          if (payload && Array.isArray(payload.fixtures)) return payload.fixtures;
          break;
        } catch (e) {
          lastErr = e;
          const code = e?.response?.data?.code;
          const msg = String(e?.response?.data?.message || '');
          if (code === 5001 || code === 5002 || code === 5013) {
            // extract include name reported in message, otherwise pop last token
            const m = msg.match(/include '\s*([^']+)'/i) || msg.match(/requested include '([^']+)'/i) || null;
            let bad = null;
            if (m && m[1]) bad = m[1].trim();
            if (!bad) bad = tokens[tokens.length - 1];
            tokens = tokens.filter(t => t !== bad);
            if (!tokens.length) break;
            console.warn('[season fetch] include rejected/no-access, removing', bad, 'and retrying for', p);
            continue;
          }
          // non-include rejection - break to try other paths
          break;
        }
      }
      if (lastErr) console.warn(`season fixtures fetch failed for ${p}:`, lastErr?.response?.data?.message || lastErr?.message || lastErr);
    } catch (e) {
      console.warn(`season fixtures fetch failed for ${p}:`, e?.message || e);
    }
  }
  // As a fallback, try to page through all leagues and collect fixtures whose season id matches (expensive)
  return null;
}

async function main() {
  const mongoUrl = mongoFromArg || process.env.MONGO_URL || process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
  console.log('connecting to', mongoUrl);
  await connectDB(mongoUrl);

  let fixtures = [];
  if (fixtureArg) {
    // process a single fixture id provided by the --fixture flag
    console.log('Processing single fixture', fixtureArg);
    fixtures = [{ id: Number(fixtureArg) }];
  } else if (seasonId) {
    console.log('Fetching fixtures for season', seasonId);
    const sfx = await fetchFixturesForSeason(seasonId);
    if (!sfx) {
      console.error('Failed to fetch fixtures for season', seasonId);
      process.exit(1);
    }
    fixtures = sfx;
    console.log('Found fixtures count', fixtures.length);
  } else {
    // No season id provided: infer a season window (Jul 1 -> Jun 30) and fetch per-day fixtures
    console.log('No season id provided; will infer season window and fetch fixtures day-by-day');
    const now = new Date();
    // season starts July 1 of current year if now >= July 1, else previous year
    const julyFirstThisYear = new Date(Date.UTC(now.getUTCFullYear(), 6, 1));
    const seasonStart = now >= julyFirstThisYear ? julyFirstThisYear : new Date(Date.UTC(now.getUTCFullYear() - 1, 6, 1));
    const seasonEnd = new Date(Date.UTC(seasonStart.getUTCFullYear() + 1, 5, 30));
    console.log('Season window:', seasonStart.toISOString().slice(0,10), '->', seasonEnd.toISOString().slice(0,10));

    // iterate dates and fetch per-day fixtures (uses existing /fixtures/date/{date} endpoint)
  // use the provider tokens you listed, excluding 'rates' and 'commentaries'
  const includes = 'events;participants;lineups.detailedposition;statistics;periods;comments;scores;timeline;formations';
    const dayMs = 24 * 60 * 60 * 1000;
    for (let d = new Date(seasonStart); d <= seasonEnd; d = new Date(d.getTime() + dayMs)) {
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${day}`;
      try {
        const res = await smGet(`/fixtures/date/${dateStr}`, { include: includes });
        const payload = res?.data?.data || res?.data || [];
        const rows = Array.isArray(payload) ? payload : (Array.isArray(payload.data) ? payload.data : []);
        if (rows && rows.length) fixtures.push(...rows);
      } catch (e) {
        const code = e?.response?.data?.code; // include rejected or rate errors are non-fatal
        console.warn('date fetch failed for', dateStr, e?.response?.data?.message || e?.message || '');
      }
      // throttle between daily queries
      if (throttleMs > 0) await sleep(throttleMs);
      // respect limit early
      if (limit && fixtures.length >= limit) break;
    }
    console.log('Collected fixtures count (may include duplicates):', fixtures.length);
    // de-duplicate by id
    const seen = new Set();
    fixtures = fixtures.filter(f => {
      const id = f?.id || f?.fixture_id || f?.match_id;
      if (!id) return false;
      if (seen.has(String(id))) return false;
      seen.add(String(id));
      return true;
    });
    console.log('Unique fixtures after dedupe:', fixtures.length);
  }

  let processed = 0;
  for (const fx of fixtures) {
    if (limit && processed >= limit) break;
    try {
      // Many fixtures returned in season listing may be partial. Fetch full fixture with includes to get events/lineup/commentary
      const includesToTry = [
        // try a comprehensive include first (may be rejected depending on plan)
        'events;participants;lineups.detailedposition;statistics;scores;periods;timeline;formations;league;season;venue;referees;comments',
        'events;participants;lineups.detailedposition;statistics;scores;periods;timeline;formations',
        'events;participants;lineups.detailedposition;statistics;scores;periods',
        'events;participants;lineups.detailedposition;scores;periods',
        'events;participants;lineups.detailedposition;periods',
        'events;participants;lineups.detailedposition'
      ];

      let smFull = null;
      for (const inc of includesToTry) {
        try {
          const res = await smGet(`fixtures/${fx.id || fx.fixture_id || fx.match_id}`, { include: inc });
          const payload = res?.data?.data || res?.data;
          if (payload) { smFull = payload; smFull._fetched_with_include = inc; break; }
        } catch (e) {
          // if include rejected or no-access or not-on-resource, try next
          const code = e?.response?.data?.code;
          if (code === 5001 || code === 5002 || code === 5013) continue;
        }
      }

      if (!smFull) {
        // final fallback: normalize the summary fixture entry
        smFull = fx;
      }

      const norm = normaliseFixtureToMatchDoc(smFull);
      if (!norm) { console.warn('normalise returned null for', fx.id); continue; }

      // map normalized fixture into model-shaped doc
      const doc = mapToModelShape(norm, smFull);

      // First try fixture-level lineups (fixture-by-id with lineups.detailedposition)
      try {
        if ((!Array.isArray(doc.lineup.home) || doc.lineup.home.length === 0) && (!Array.isArray(doc.lineup.away) || doc.lineup.away.length === 0)) {
          const fxLineups = await fetchFixtureLineups(doc.match_id || doc.id || smFull?.id || fx.id);
          if (fxLineups) {
            doc.lineup.home = fxLineups.home || [];
            doc.lineup.away = fxLineups.away || [];
          }
        }
      } catch (e) {
        // non-fatal
      }

      // We do NOT call team-level endpoints. If fixture-level lineups were not present, we'll fall back to inferring from events.

      // If lineup still empty, infer from events as a last resort
      if ((!Array.isArray(doc.lineup.home) || doc.lineup.home.length === 0) && (!Array.isArray(doc.lineup.away) || doc.lineup.away.length === 0)) {
        const inferred = inferLineupsFromEvents(doc);
        if (inferred) {
          doc.lineup.home = inferred.home || [];
          doc.lineup.away = inferred.away || [];
        }
      }

      if (dry) {
        if (dump) {
          // print the full document as it would be written to the DB
          try { console.log(JSON.stringify(doc, null, 2)); } catch (e) { console.log('(dry) would upsert', doc.match_id); }
        } else {
          console.log('(dry) would upsert', doc.match_id, 'events=', (doc.events || []).length, 'lineup.home=', (doc.lineup?.home || []).length, 'lineup.away=', (doc.lineup?.away || []).length);
        }
      } else {
        // Build a safe $set payload that only includes canonical fields from the model.
        // Avoid writing legacy top-level fields like `home_team`, `away_team`, `date`,
        // `status`, `status_code`, `report` which are deprecated in the schema.
        const setObj = {};
        const canonicalKeys = [
          'match_info','score','events','lineup','player_stats','participants','player_ratings','match_status','player_of_the_match','potm','reports'
        ];
        for (const k of canonicalKeys) {
          if (doc[k] !== undefined) setObj[k] = doc[k];
        }
        // Write teams using dotted paths to avoid creating a top-level `teams` object that
        // could conflict with other dotted updates.
        if (doc.teams && doc.teams.home) setObj['teams.home'] = doc.teams.home;
        if (doc.teams && doc.teams.away) setObj['teams.away'] = doc.teams.away;

        // Ensure deprecated top-level fields are removed on update.
        const unsetObj = {
          date: "",
          home_team: "",
          away_team: "",
          home_team_id: "",
          away_team_id: "",
          home_team_slug: "",
          away_team_slug: "",
          minute: "",
          time_added: "",
          status: "",
          status_code: "",
          report: "",
          player_ratings: ""
        };

        await Match.findOneAndUpdate({ match_id: doc.match_id }, { $set: setObj, $unset: unsetObj }, { upsert: true });
        console.log('Upserted', doc.match_id);
      }

      processed++;
      if (throttleMs > 0) await sleep(throttleMs);
    } catch (e) {
      console.error('Failed to process fixture', fx?.id || fx?.match_id, e?.response?.data || e?.message || e);
    }
  }

  console.log('Done, processed', processed);
  process.exit(0);
}

main().catch(e => { console.error('Script failed', e); process.exit(1); });
