// controllers/matchSyncController.js
const axios = require('axios');
const { get: smGet } = require('../utils/sportmonks');
const Match = require('../models/Match');
const Team = require('../models/Team');

// Utility: slugify team names (matches your Match schema)
const slugify = s =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

// Fetch full match stats from SportMonks
// include 'time' so we get minute/added_time/status when available
async function fetchMatchStats(matchId, opts = {}) {
  // Use the shared sportmonks helper so base URL and token handling are consistent
  // many plans don't support 'stats'/'statistics' includes; prefer these safer permutations
  // If caller explicitly asks for finished-match behaviour, prefer detailed
  // lineup includes first so ratings embedded in lineup.details are returned.
  // If includeStatistics is requested, add statistics to the includes
  const baseIncludes = opts.forFinished ? [
    'lineups.player;lineups.details;formations;events;participants;periods;comments;scores;state',
    'lineups.player;lineups.details;formations;events;participants;rates;periods;comments;scores;state',
    'lineups.player;lineups.details;formations;events;participants;periods;comments;scores;state',
    'lineups.player;lineups.details;formations;comments;scores;state',
    'lineups.details;formations;events;participants;periods;comments;scores;state',
    'lineups;formations;events;participants;periods;comments;scores;state',
    // fallback ordering
    'lineups;formations;comments;scores;state',
    'lineups;comments;scores;state',
    'line;comments;scores;state',
    'events;participants;lineups;periods;comments;scores;state',
    'events;participants;lineup;periods;comments;scores;state',
    'state;comments;scores',
    'time;comments;scores;state'
  ] : [
    // default ordering (safe lightweight includes first)
    'state;comments;scores',
    'time;comments;scores',
    'lineups.player;lineups.details;formations;events;participants;periods;comments;scores;state',
    'lineups.player;lineups.details;formations;comments;scores;state',
    'lineups;formations;comments;scores;state',
    'lineups;comments;scores;state',
    'line;comments;scores;state',
    'lineups;events;participants;scores;periods;comments;state',
    'events;participants;lineups;scores;periods;comments;state',
    'events;participants;lineup;periods;comments;scores;state',
    'lineup.player;events;participants;periods;comments;scores;state'
  ];

  // Add statistics to includes if requested
  const includesToTry = opts.includeStatistics 
    ? baseIncludes.map(inc => {
        // Ensure participants are always included when statistics are requested
        if (!inc.includes('participants')) {
          return inc + ';participants;statistics';
        }
        return inc + ';statistics';
      })
    : baseIncludes;

  let lastErr = null;
  for (const inc of includesToTry) {
    try {
      const res = await smGet(`fixtures/${matchId}`, { include: inc });
      const payload = res?.data?.data || res?.data;
      if (payload) {
        payload._fetched_with_include = inc;
        return payload;
      }
    } catch (e) {
      lastErr = e;
    }
  }

  if (lastErr) throw lastErr;
  return null;
}

// Try to fetch a team's squad/players using a few common SportMonks endpoints
async function fetchTeamSquad(teamId) {
  if (!teamId) return null;
  const candidates = [
    `teams/${teamId}/squad`,
    `teams/${teamId}/players`,
    `players/teams/${teamId}`,
    `squads/${teamId}`
  ];

  for (const p of candidates) {
    try {
      const res = await smGet(p);
      // res.data may be the payload or res.data.data in some shapes
      const payload = res?.data?.data || res?.data;
      if (payload && (Array.isArray(payload) || payload.players || payload.data)) {
        return payload;
      }
    } catch (e) {
      // continue trying
    }
  }
  return null;
}

// Compute the MOM candidate (highest rating)
function getMomCandidate(playerRatings = []) {
  if (!playerRatings.length) return null;
  return playerRatings.reduce((best, curr) => (curr.rating > (best.rating || 0) ? curr : best), {});
}

// Main sync function
async function syncFinishedMatch(matchId) {
  // Load match from DB
  const match = await Match.findOne({ match_id: matchId });
  if (!match) throw new Error(`Match not found: ${matchId}`);

  // If DB already has a match_status indicating finished, we can skip re-marking
  try {
    const shortName = match.match_status && (match.match_status.short_name || match.match_status.state);
    if (String(shortName || '').toUpperCase() === 'FT') {
      console.log(`Match ${matchId} already marked finished — will attempt to ensure lineup ratings are present.`);
    }
  } catch (e) {
    // ignore
  }

  // Fetch from SportMonks (prefer finished-match detailed includes so lineup.details and team ids are present)
  const smMatch = await fetchMatchStats(matchId, { forFinished: true });

  if (!smMatch) throw new Error(`No data from SportMonks for match ${matchId}`);

  // Normalise SportMonks payload first to get properly extracted team data
  let norm = null;
  try {
    const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
    norm = normaliseFixtureToMatchDoc(smMatch) || {};
  } catch (e) {
    console.warn('normaliseFixtureToMatchDoc failed:', e.message || e);
    norm = {};
  }

  // Debug: log useful diagnostics (fetched include + resolved ids + participants sample)
  try {
    const resolvedMatchContext = {
      home_team_id: norm.home_team_id ?? match.home_team_id,
      away_team_id: norm.away_team_id ?? match.away_team_id,
      localteam_id: norm.home_team_id ?? match.home_team_id, // legacy field
      visitorteam_id: norm.away_team_id ?? match.away_team_id, // legacy field
      home_team: norm.home_team ?? match.home_team,
      away_team: norm.away_team ?? match.away_team
    };
    const participantsSample = (smMatch.participants?.data || smMatch.participants || []).slice(0,3).map(p => ({ id: p.id ?? p.participant_id, name: p.name || p.short_code || null, meta: p.meta || null }));
    console.debug('sportmonks fetch:', { include: smMatch._fetched_with_include || null, resolvedMatchContext, participantsSample });
  } catch (e) {
    // non-fatal
  }

  // norm is already computed above for debug logging

  // Extract provider player ratings if available
  let ratings = [];
  if (smMatch.rates?.data) {
    for (const r of smMatch.rates.data) {
      if (r.player && r.rating != null) {
        ratings.push({
          player: r.player.name,
          player_id: r.player.id || null,
          rating: Number(r.rating),
          team: r.team_id === smMatch.home_team_id ? smMatch.home_team.name : smMatch.away_team.name,
          inferred: false,
          source: 'sportmonks',
          calculated_at: new Date()
        });
      }
    }
  }

  // Also extract provider ratings embedded in lineup.details (type_id === 118)
  try {
    const rawLineups = smMatch.lineups?.data || smMatch.lineups || smMatch.lineup || [];
    const collectDetails = (items) => {
      for (const it of (items || [])) {
        const detailsArr = it.details || it.details?.data || [];
        for (const d of (detailsArr || [])) {
          try {
            if ((d.type_id === 118 || (d.type && Number(d.type) === 118)) && d.data && d.data.value != null) {
              ratings.push({
                player: d.player_name || d.player_name || null,
                player_id: d.player_id ?? d.player?.id ?? null,
                rating: Number(d.data.value),
                team_id: d.team_id || null,
                team: d.team_id == smMatch.home_team_id ? (smMatch.home_team?.name || null) : (smMatch.away_team?.name || null),
                inferred: false,
                source: 'sportmonks-lineup-detail',
                calculated_at: new Date()
              });
            }
          } catch (e) { /* ignore malformed detail */ }
        }
        // if this group has nested players with details, recurse
        if (Array.isArray(it.players)) collectDetails(it.players);
      }
    };
    // normalized lineup shape may be available on norm.lineups
    if (norm && Array.isArray(norm.lineups)) collectDetails(norm.lineups);
    collectDetails(Array.isArray(rawLineups) ? rawLineups : (rawLineups.data || []));
  } catch (e) {
    // non-fatal
  }

  // Prefer normalized player_stats (derived from events or fixture.statistics) if available
  const playerStats = (norm && norm.player_stats) ? norm.player_stats : [];

  // lineup arrays (function scope) - populated below
  let lineupHome = [];
  let lineupAway = [];

  // Attach ratings to playerStats where possible (match by player name)
  if (ratings.length && playerStats.length) {
    const ratingMap = new Map(ratings.map(r => [String(r.player).toLowerCase(), r.rating]));
    for (const ps of playerStats) {
      const r = ratingMap.get(String(ps.player).toLowerCase());
      if (r != null) ps.rating = r;
    }
  }

  // Do NOT infer ratings from events. Only accept provider-supplied ratings.
  // If SportMonks did not include ratings, `ratings` will remain empty.

  // If we have lineup info (from fixture) or can fetch team squads, do not add any
  // inferred/baseline ratings. We will build the lineup but only attach ratings
  // when they are explicitly present in the provider payload.
  try {
    // prefer lineup from smMatch if present
    // Use normalized lineup if available, otherwise fall back to raw smMatch.lineup
    lineupHome = (norm && norm.lineup && Array.isArray(norm.lineup.home)) ? norm.lineup.home : [];
    lineupAway = (norm && norm.lineup && Array.isArray(norm.lineup.away)) ? norm.lineup.away : [];
    if ((!lineupHome.length || !lineupAway.length) && smMatch.lineup) {
      const lups = smMatch.lineup?.data || smMatch.lineup || smMatch.lineups || smMatch.lineups?.data || [];
      for (const group of lups) {
        const teamIsHome = group.team_id == smMatch.localteam_id || group.team_id == smMatch.home_team_id || String(group.type || '').toLowerCase().includes('home');
        const arr = (teamIsHome ? lineupHome : lineupAway);
        if (Array.isArray(group.players)) {
          for (const p of group.players) arr.push({ player_id: p.player_id ?? p.player?.id ?? p.id, name: p.player?.name || p.player_name || p.name, number: p.number ?? null, position: p.position ?? p.role ?? null });
        }
      }
    }

    // If lineup still empty, attempt to fetch team squads and build a lineup
    if ((!lineupHome.length || !lineupAway.length) && (smMatch.home_team_id || smMatch.away_team_id)) {
      try {
        if (!lineupHome.length) {
          const homeSquad = await fetchTeamSquad(smMatch.home_team_id || smMatch.localteam_id);
          if (homeSquad) {
            const players = Array.isArray(homeSquad) ? homeSquad : (homeSquad.players || homeSquad.data || []);
            for (const p of players) lineupHome.push({ player_id: p.id ?? p.player_id ?? p.player?.id, name: p.fullname || p.name || p.player?.name || p.player_name || null, number: p.number ?? null, position: p.position ?? null });
          }
        }
        if (!lineupAway.length) {
          const awaySquad = await fetchTeamSquad(smMatch.away_team_id || smMatch.visitorteam_id);
          if (awaySquad) {
            const players = Array.isArray(awaySquad) ? awaySquad : (awaySquad.players || awaySquad.data || []);
            for (const p of players) lineupAway.push({ player_id: p.id ?? p.player_id ?? p.player?.id, name: p.fullname || p.name || p.player?.name || p.player_name || null, number: p.number ?? null, position: p.position ?? null });
          }
        }
      } catch (e) {
        // non-fatal
        console.warn('team squad fetch failed (non-fatal):', e.message || e);
      }
    }

    // Intentionally do not apply any baseline ratings here.
  } catch (e) {
    console.warn('ensureLineupBaselines failed:', e.message || e);
  }

  // If we constructed lineupHome/lineupAway above (from norm or squad fetch),
  // ensure we persist them on the match doc with ratings attached so downstream
  // consumers (reports, UI) have a canonical lineup with per-player ratings.
  try {
    if ((lineupHome && lineupHome.length) || (lineupAway && lineupAway.length)) {
      // build rating lookup maps (prefer provider/inferred ratings, fall back to DB)
      const ratingMapById = new Map();
      const ratingMapByName = new Map();
      for (const r of ratings || []) {
        if (r.player_id != null) ratingMapById.set(String(r.player_id), r.rating);
        if (r.player) ratingMapByName.set(String(r.player).toLowerCase(), r.rating);
      }
      const dbRatings = (match && Array.isArray(match.player_ratings)) ? match.player_ratings : [];
      for (const r of dbRatings) {
        if (r.player_id != null) {
          const k = String(r.player_id);
          if (!ratingMapById.has(k) && r.rating != null) ratingMapById.set(k, r.rating);
        }
        if (r.player) {
          const nk = String(r.player).toLowerCase();
          if (!ratingMapByName.has(nk) && r.rating != null) ratingMapByName.set(nk, r.rating);
        }
      }

      const attachRatingsTo = (arr) => (arr || []).map(p => {
        const pid = p.player_id != null ? String(p.player_id) : null;
        let rating = null;
        if (pid && ratingMapById.has(pid)) rating = ratingMapById.get(pid);
        else if (p.name && ratingMapByName.has(String(p.name).toLowerCase())) rating = ratingMapByName.get(String(p.name).toLowerCase());
        return { ...p, rating: rating ?? p.rating ?? null };
      });

      // attach ratings and set onto a temporary payload - will be applied when building setPayload
      var prebuiltLineup = { home: attachRatingsTo(lineupHome || []), away: attachRatingsTo(lineupAway || []) };
      // store on a variable we'll use later when composing setPayload
      // (use let-binding above? but here just attach to smMatch so it's available later)
      smMatch._prebuilt_lineup = prebuiltLineup;
    }
  } catch (e) {
    console.warn('prebuild lineup with ratings failed:', e.message || e);
  }

  // Pick MOM candidate from whichever ratings we have (but do not pick cross-team)
  const mom = getMomCandidate(ratings);

  // Update match document
  // Build the update payload - include lineup and player_stats if available from SportMonks
  // Prefer the normalized status/status_code from the fixture; if smMatch doesn't provide status, keep existing DB status (important to not overwrite FT)
  // Only overwrite player_ratings if we actually have ratings to write.
  // This prevents accidental clearing of previously persisted inferred/provider ratings
  // when a subsequent SportMonks fetch returns no rating data.
  // Decide which events to persist: prefer normalized events, fall back to provider events,
  // and do not overwrite existing events with an empty array.
  let eventsToPersist = Array.isArray(match.events) ? match.events : [];
  if (norm && Array.isArray(norm.events) && norm.events.length) {
    eventsToPersist = norm.events;
  } else {
    const smEvents = smMatch.events?.data || smMatch.events || [];
    if (Array.isArray(smEvents) && smEvents.length) eventsToPersist = smEvents;
  }

  // Decide which comments to persist: prefer normalized comments, fall back to provider comments,
  // and do not overwrite existing comments with an empty array.
  // Merge comments rather than replacing so we don't lose history if provider omits comments
  const { mergeComments } = require('../utils/comments');

  let commentsToPersist = Array.isArray(match.comments) ? match.comments : [];
  if (norm && Array.isArray(norm.comments) && norm.comments.length) {
    commentsToPersist = mergeComments(commentsToPersist, norm.comments);
  } else {
    const smComments = smMatch.comments?.data || smMatch.comments || [];
    if (Array.isArray(smComments) && smComments.length) commentsToPersist = mergeComments(commentsToPersist, smComments);
  }

  // Determine minute/added_time to persist: prefer normalized minute, fall back to provider time fields,
  // otherwise keep existing DB minute/add_time.
  let minuteToPersist = Number.isFinite(match.minute) ? match.minute : null;
  let addedTimeToPersist = Number.isFinite(match.added_time) ? match.added_time : null;
  if (norm && Number.isFinite(norm.minute)) {
    minuteToPersist = norm.minute;
  } else if (smMatch && smMatch.time) {
    minuteToPersist = Number(smMatch.time.minute ?? smMatch.time.current ?? minuteToPersist);
    addedTimeToPersist = Number(smMatch.time.added_time ?? smMatch.time.extra_minute ?? addedTimeToPersist);
  }

  // helper: merge player ratings (prefer incoming, fall back to DB)
  const mergePlayerRatings = (dbArr = [], incomingArr = []) => {
    const map = new Map();
    const keyFor = (r) => (r && r.player_id != null) ? `id:${r.player_id}` : (r && r.player ? `name:${String(r.player).toLowerCase()}` : null);
    // seed with DB entries
    for (const r of (dbArr || [])) {
      const k = keyFor(r);
      if (k && !map.has(k)) map.set(k, r);
    }
    // overlay incoming ratings
    for (const r of (incomingArr || [])) {
      const k = keyFor(r);
      if (!k) continue;
      const prev = map.get(k) || {};
      // prefer incoming values but preserve existing keys when missing
      map.set(k, { ...prev, ...r, calculated_at: r.calculated_at || new Date() });
    }
    return Array.from(map.values());
  };

  const mergedPlayerRatings = mergePlayerRatings(match.player_ratings || [], ratings || []);

  const setPayload = {
    player_ratings: mergedPlayerRatings,
    player_stats: playerStats,
    player_of_the_match: (mom && mom.player) ? mom.player : (match.player_of_the_match || null),
    // Persist events when available so UI and inference have up-to-date event streams
    events: eventsToPersist,
    // Persist comments and live minute/added_time when available
    comments: commentsToPersist,
    minute: Number.isFinite(minuteToPersist) ? minuteToPersist : (match.minute ?? null),
    added_time: Number.isFinite(addedTimeToPersist) ? addedTimeToPersist : (match.added_time ?? null),
  // legacy `status`/`status_code` removed; keep `match_status` (canonical provider object)
    // include full provider state object when available for richer UI and debugging
    match_status: (norm && norm.match_status) ? norm.match_status : (
      smMatch?.state ? smMatch.state : (
        smMatch?.time ? {
          id: null,
          state: smMatch.time.status ?? '',
          name: smMatch.time.status ?? '',
          short_name: smMatch.time.status_code ?? '',
          developer_name: ''
        } : match.match_status || { id: null, state: '', name: '', short_name: '', developer_name: '' }
      )
    )
  };

  // Attach source metadata for debugging/traceability
  setPayload.sources = { sportmonks: { last_fetched_with_include: smMatch._fetched_with_include || null, last_fetched_at: new Date() } };

  // If configured, and we have a provider state id, fetch the canonical state resource
  try {
    const shouldFetchState = !!process.env.SPORTMONKS_FETCH_STATE;
    const provStateId = (smMatch && (smMatch.state?.id || smMatch.state_id || smMatch.time?.status_id)) || null;
    if (shouldFetchState && provStateId) {
      try {
        const sres = await smGet(`states/${provStateId}`);
        const statePayload = sres?.data?.data || sres?.data;
        if (statePayload) {
          // prefer canonical payload (id, state, name, short_name, developer_name)
          setPayload.match_status = {
            id: statePayload.id ?? statePayload._id ?? provStateId,
            state: statePayload.state ?? statePayload.short_name ?? statePayload.name ?? '',
            name: statePayload.name ?? statePayload.state ?? '',
            short_name: statePayload.short_name ?? statePayload.state ?? '',
            developer_name: statePayload.developer_name ?? ''
          };
        }
      } catch (e) {
        // non-fatal; keep existing match_status
        console.warn('Failed to fetch canonical state for', provStateId, e?.response?.data || e?.message || e);
      }
    }
  } catch (e) {
    // ignore
  }

  // copy lineup from SportMonks if present (accept multiple shapes: lineup, lineups, line)
  if (smMatch.lineup || smMatch.lineups || smMatch.line) {
    try {
      const { partitionRawLineups } = require('../utils/lineup');
      // Provide sensible fallbacks: if SportMonks fixture doesn't include explicit
      // home/away ids, use the DB match record which should have canonical ids.
      const matchContext = {
        home_team_id: smMatch.home_team_id ?? smMatch.localteam_id ?? match.home_team_id,
        away_team_id: smMatch.away_team_id ?? smMatch.visitorteam_id ?? match.away_team_id,
        localteam_id: smMatch.localteam_id ?? smMatch.home_team_id ?? match.home_team_id,
        visitorteam_id: smMatch.visitorteam_id ?? smMatch.away_team_id ?? match.away_team_id,
        home_team: smMatch.home_team ?? match.home_team,
        away_team: smMatch.away_team ?? match.away_team
      };
      const parts = partitionRawLineups(smMatch, matchContext);
      if ((parts.home && parts.home.length) || (parts.away && parts.away.length)) {
        // Attach ratings to each lineup entry where possible. Prefer matching by player_id, fall back to name.
        // Build rating maps preferring provider/inferred ratings, but fall back to DB-stored player_ratings
        const ratingMapById = new Map();
        const ratingMapByName = new Map();
        // ratings variable contains provider rates or inferred ratings produced above
        for (const r of ratings || []) {
          if (r.player_id != null) ratingMapById.set(String(r.player_id), r.rating);
          if (r.player) ratingMapByName.set(String(r.player).toLowerCase(), r.rating);
        }
        // fallback to match.player_ratings persisted in DB (do not overwrite existing keys)
        const dbRatings = (match && Array.isArray(match.player_ratings)) ? match.player_ratings : [];
        for (const r of dbRatings) {
          if (r.player_id != null) {
            const k = String(r.player_id);
            if (!ratingMapById.has(k) && r.rating != null) ratingMapById.set(k, r.rating);
          }
          if (r.player) {
            const nk = String(r.player).toLowerCase();
            if (!ratingMapByName.has(nk) && r.rating != null) ratingMapByName.set(nk, r.rating);
          }
        }

        const attachRatingsToParts = (arr) => (arr || []).map(p => {
          const pid = p.player_id != null ? String(p.player_id) : null;
          let rating = null;
          if (pid && ratingMapById.has(pid)) rating = ratingMapById.get(pid);
          else if (p.name && ratingMapByName.has(String(p.name).toLowerCase())) rating = ratingMapByName.get(String(p.name).toLowerCase());
          return { ...p, rating: rating ?? p.rating ?? null };
        });

          // dedupe helper: prefer player_id keyed items, then items with rating, then first seen
          const dedupeLineup = (arr = []) => {
            const out = new Map();
            const normalizeName = (s) => {
              if (!s && s !== 0) return null;
              return String(s).replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
            };
            const keyForItem = (p) => {
              if (!p) return null;
              if (p.player_id != null) return `id:${p.player_id}`;
              const name = normalizeName(p.player_name || p.name || p.player || '');
              if (name) return `name:${name}`;
              const num = p.jersey_number ?? p.number ?? null;
              const team = p.team_id ?? (p.team && (p.team.id || p.team)) ?? null;
              if (num != null) return `num:${String(num)}@${team ?? '0'}`;
              return null;
            };

            for (const p of (arr || [])) {
              const k = keyForItem(p) || `gen:${Math.random()}`;
              if (!out.has(k)) { out.set(k, p); continue; }
              const existing = out.get(k) || {};
              // prefer entry with player_id
              if ((existing.player_id == null) && (p.player_id != null)) { out.set(k, p); continue; }
              // prefer entry with non-null rating
              if ((existing.rating == null) && (p.rating != null)) { out.set(k, { ...existing, ...p }); continue; }
              // otherwise keep existing but merge missing fields
              const merged = { ...existing };
              for (const pk of Object.keys(p || {})) {
                if (merged[pk] === undefined || merged[pk] === null) merged[pk] = p[pk];
              }
              out.set(k, merged);
            }
            return Array.from(out.values());
          };

        // If we already have a DB lineup, prefer attaching ratings directly to the
        // existing DB entries so we don't reassign players to the wrong side or
        // overwrite any canonical fields (team_id, player_name, jersey_number, etc).
        if (match && match.lineup && ((match.lineup.home && match.lineup.home.length) || (match.lineup.away && match.lineup.away.length))) {
          const attachRatingsToDb = (dbArr) => (dbArr || []).map(p => {
            const pid = p.player_id != null ? String(p.player_id) : null;
            // check both player_name and name as possible keys in ratingMapByName
            const nameKey = p.player_name ? String(p.player_name).toLowerCase() : (p.name ? String(p.name).toLowerCase() : null);
            let rating = null;
            if (pid && ratingMapById.has(pid)) rating = ratingMapById.get(pid);
            else if (nameKey && ratingMapByName.has(nameKey)) rating = ratingMapByName.get(nameKey);
            return { ...p, rating: rating ?? p.rating ?? null };
          });

          const homeWithRatings = attachRatingsToDb(match.lineup.home || []);
          const awayWithRatings = attachRatingsToDb(match.lineup.away || []);
          setPayload.lineup = { home: homeWithRatings, away: awayWithRatings };
          console.log(`persisting ratings onto existing DB lineup: home=${homeWithRatings.length} away=${awayWithRatings.length}`);
        } else {
          const homeWithRatings = attachRatingsToParts(parts.home || []);
          const awayWithRatings = attachRatingsToParts(parts.away || []);
          setPayload.lineup = { home: homeWithRatings, away: awayWithRatings };
          console.log(`persisting lineup from SportMonks: home=${homeWithRatings.length} away=${awayWithRatings.length}`);
        }
      }
    } catch (e) {
      console.warn('failed to copy lineup from sportmonks:', e.message || e);
    }
  }

  // If we prebuilt a lineup earlier (from normalized payload / squad fetch) prefer that
  // Note: prebuilt lineup (smMatch._prebuilt_lineup) will already be set earlier if we fetched squads and built it.
  if (!setPayload.lineup && smMatch._prebuilt_lineup) {
    setPayload.lineup = smMatch._prebuilt_lineup;
    console.log(`persisting prebuilt lineup: home=${(smMatch._prebuilt_lineup.home||[]).length} away=${(smMatch._prebuilt_lineup.away||[]).length}`);
  }

  // clean helper: strip undefined keys so $set won't clear existing DB values
  const cleanForUpsert = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const k of Object.keys(obj)) {
      if (obj[k] === undefined) continue;
      out[k] = obj[k];
    }
    return out;
  };

  // Merge incoming lineup with DB lineup (preserve DB entries, overlay incoming fields and ratings)
  // BUT: for finished matches with complete lineup data, prefer replacement to avoid duplication
  try {
    const matchIsFinished = (match && match.match_status && (match.match_status.short_name === 'FT' || match.match_status.state === 'FT'));
    const incomingIsComplete = setPayload.lineup && setPayload.lineup.home && setPayload.lineup.away && 
                               (setPayload.lineup.home.length > 10 && setPayload.lineup.away.length > 10);
    
    if (setPayload.lineup && match && match.lineup && !matchIsFinished && !incomingIsComplete) {
      const mergeLineupSide = (dbArr = [], incArr = []) => {
        const map = new Map();
        // stable generator for anonymous keys so we don't rely on Math.random()
        let genIndex = 0;
        const normalizeName = (s) => {
          if (!s && s !== 0) return null;
          return String(s)
            .replace(/\u00A0/g, ' ') // NBSP -> space
            .replace(/\s+/g, ' ') // collapse whitespace
            .trim()
            .toLowerCase();
        };
        const keyFor = (p) => {
          if (!p) return null;
          if (p.player_id != null) return `id:${p.player_id}`;
          // accept multiple possible name fields used across the codebase
          const rawName = p.player_name || p.name || (p.player && (p.player.name || p.player.fullname)) || null;
          const nameVal = normalizeName(rawName);
          if (nameVal) return `name:${nameVal}`;
          // fallback try: combine jersey/number with team id to form a likely-stable key
          const num = p.jersey_number ?? p.number ?? null;
          const team = p.team_id ?? (p.team && (p.team.id || p.team)) ?? null;
          if (num != null) return `num:${String(num)}@${team ?? '0'}`;
          return null;
        };

        for (const p of dbArr || []) {
          const k = keyFor(p) || `gen:${genIndex++}`;
          map.set(k, { ...p });
        }
        for (const p of incArr || []) {
          const k = keyFor(p) || `gen:${genIndex++}`;
          const prev = map.get(k) || {};
          // We must NOT overwrite existing DB fields with incoming payloads.
          // Only add missing fields from incoming, and always prefer incoming rating when present.
          const merged = { ...prev };
          // copy any keys from incoming that are missing in prev
          for (const pk of Object.keys(p || {})) {
            if (pk === 'rating') continue; // handle rating separately
            if (merged[pk] === undefined || merged[pk] === null) merged[pk] = p[pk];
          }
          // rating: prefer incoming value when present, otherwise keep prev.rating
          merged.rating = (p && p.rating != null) ? p.rating : prev.rating;
          map.set(k, merged);
        }
        return Array.from(map.values());
      };

      const mergedHome = mergeLineupSide((match.lineup && match.lineup.home) || [], setPayload.lineup.home || []);
      const mergedAway = mergeLineupSide((match.lineup && match.lineup.away) || [], setPayload.lineup.away || []);
      setPayload.lineup = { home: mergedHome, away: mergedAway };
    } else if (matchIsFinished && incomingIsComplete) {
      console.log(`skipping lineup merge for finished match ${matchId} - using complete replacement`);
    }
  } catch (e) {
    console.warn('lineup merge failed, proceeding with incoming lineup:', e.message || e);
  }

  // Prune placeholder/empty team fields and empty match_status so we don't
  // unintentionally wipe DB values when provider data is partial.
  //
  // Background: this function is called when a match finishes and we fetch
  // enriched SportMonks data. The normalised payload may contain placeholder
  // team names or an empty match_status object; writing those into the DB
  // would remove the canonical team entries created by the daily fixture
  // cron and could clear a previously-correct match_status. Only persist
  // these fields when the incoming values are meaningful.
  try {
    const isMeaningfulTeamName = (name) => !!(name && String(name).trim() && !['home', 'away', 'Home', 'Away'].includes(String(name)));
    const hasMeaningfulTeamId = (id) => (id != null && id !== '');

    if (!isMeaningfulTeamName(setPayload.home_team) && !hasMeaningfulTeamId(setPayload.home_team_id)) {
      delete setPayload.home_team;
      delete setPayload.home_team_id;
      delete setPayload.home_team_slug;
    }
    if (!isMeaningfulTeamName(setPayload.away_team) && !hasMeaningfulTeamId(setPayload.away_team_id)) {
      delete setPayload.away_team;
      delete setPayload.away_team_id;
      delete setPayload.away_team_slug;
    }

    if (setPayload.match_status && typeof setPayload.match_status === 'object') {
      const ms = setPayload.match_status;
      const hasAny = (ms.id != null && ms.id !== '') || (ms.short_name && String(ms.short_name).trim()) || (ms.state && String(ms.state).trim()) || (ms.name && String(ms.name).trim());
      if (!hasAny) delete setPayload.match_status;
    }
  } catch (e) {
    console.warn('prune setPayload failed:', e?.message || e);
  }

  const updated = await Match.findOneAndUpdate(
    { match_id: matchId },
    // Also derive flattened `lineups` array from the merged grouped lineup for new schema compatibility
    (function prepareAndUpdate() {
      try {
        if (setPayload.lineup && (!setPayload.lineups || !setPayload.lineups.length)) {
          const flat = [];
          const seen = new Set();
          const pushFrom = (arr, teamId) => {
            for (const p of (arr || [])) {
              const playerId = p.player_id ?? null;
              const team_id = p.team_id ?? teamId ?? null;
              // compute stable key to avoid duplicates
              const key = playerId != null ? `id:${playerId}` : (`name:${String(p.player_name || p.name || p.player || '')}`.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase());
              if (seen.has(key)) continue; // skip duplicate
              seen.add(key);
              // map canonical fields and include the direct `rating` field on the lineup item
              flat.push({
                player_id: playerId,
                team_id,
                player_name: p.player_name || p.name || p.player || '',
                position_id: p.position_id ?? p.position ?? null,
                formation_field: p.formation_field ?? null,
                formation_position: p.formation_position ?? p.role ?? null,
                jersey_number: p.jersey_number ?? p.number ?? null,
                type_id: p.type_id ?? null,
                rating: (p.rating != null) ? p.rating : null
              });
            }
          };
          pushFrom(setPayload.lineup.home || [], match.home_team_id || match.homeId || null);
          pushFrom(setPayload.lineup.away || [], match.away_team_id || match.awayId || null);
          setPayload.lineups = flat;
        }

        // REVERSE LOGIC: Generate lineup.home/away from lineups array if lineups has better data
        if (setPayload.lineups && setPayload.lineups.length > 0) {
          const homeId = match?.home_team_id || match?.localteam_id;
          const awayId = match?.away_team_id || match?.visitorteam_id;
          
          // Only regenerate lineup structure if we have team IDs and the lineups data looks complete
          if (homeId && awayId) {
            const homeLineup = setPayload.lineups.filter(p => p.team_id === homeId);
            const awayLineup = setPayload.lineups.filter(p => p.team_id === awayId);
            
            // Only update if we got reasonable data (at least 5 players per side)
            if (homeLineup.length >= 5 && awayLineup.length >= 5) {
              setPayload.lineup = { 
                home: homeLineup,
                away: awayLineup 
              };
              console.log(`[matchSync] Auto-generated lineup structure from lineups data: home=${homeLineup.length} away=${awayLineup.length}`);
            }
          }
        }
      } catch (e) { /* non-fatal */ }
      return { $set: cleanForUpsert(setPayload) };
    })(),
    { new: true }
  );


  // After updating the match, only trigger report generation when the status transitioned to finished (FT).
  try {
    // Determine previous DB status (if any) — we have `match` from before the update above
    const prevShort = String((match.match_status && (match.match_status.short_name || match.match_status.state)) || '').toUpperCase();
    const newShort = String((updated.match_status && (updated.match_status.short_name || updated.match_status.state)) || '').toUpperCase();

    const becameFT = prevShort !== 'FT' && newShort === 'FT';
    const alreadyFT = prevShort === 'FT' && newShort === 'FT';

    if (becameFT) {
      const { generateBothReports } = require('./reportController'); // lazy require to avoid circular load
      console.log(`[matchSync] Match ${matchId} status transitioned to FT — generating reports.`);
      await generateBothReports(matchId);
    } else if (alreadyFT) {
      // If already FT, do not auto-generate again to avoid duplicates.
      console.log(`[matchSync] Match ${matchId} already FT — skipping auto-report generation.`);
    } else {
      // Not finished yet — skip report generation
      console.log(`[matchSync] Match ${matchId} status updated (${prevShort} => ${newShort}) — not triggering reports.`);
    }
  } catch (e) {
    console.warn('generateBothReports failed (non-fatal):', e.message || e);
  }

  return updated;
}

// Export
module.exports = { syncFinishedMatch, fetchMatchStats };
