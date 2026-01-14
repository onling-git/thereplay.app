// utils/normaliseFixture.js

// local slug helper (keeps things robust even if model hooks haven't run yet)
const slugify = s =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

// Robust provider date parsing utility. Tries numeric timestamps, ISO strings
// with timezone, and common space-separated formats like 'YYYY-MM-DD HH:mm:ss'.
// Treats ambiguous 'YYYY-MM-DD HH:mm:ss' as UTC (policy decision).
function parseProviderDate(val) {
  if (val == null) return null;
  // number: unix seconds or ms
  if (typeof val === 'number') {
    // heuristic: if <= 1e10 treat as seconds, else milliseconds
    return new Date(val > 1e10 ? val : val * 1000);
  }
  const s = String(val).trim();
  if (!s) return null;
  // common no-zone format: 'YYYY-MM-DD HH:mm:ss' -> interpret as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  // If string looks like a plain numeric seconds value
  if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000);
  if (/^\d{13}$/.test(s)) return new Date(Number(s));
  // Fallback to Date parsing (handles ISO with timezone and 'Z')
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

/**
 * Normalises a Sportmonks v3 fixture into your Match schema shape.
 * Expect you call Sportmonks with include=events;participants;scores
 */
// Map well-known event type_id values to canonical uppercase codes
const EVENT_TYPE_MAP = {
  10: 'VAR',
  14: 'GOAL',
  15: 'OWNGOAL',
  16: 'PENALTY',
  17: 'MISSED_PENALTY',
  18: 'SUBSTITUTION',
  19: 'YELLOWCARD',
  20: 'REDCARD',
  21: 'YELLOWREDCARD',
  22: 'PENALTY_SHOOTOUT_MISS',
  23: 'PENALTY_SHOOTOUT_GOAL'
};

function mapEventType(typeId, typeObjOrName) {
  if (typeId != null && EVENT_TYPE_MAP[typeId]) return EVENT_TYPE_MAP[typeId];
  // fallback: if provider gave an object or name, normalise to uppercase code-like string
  if (typeObjOrName) {
    const s = typeof typeObjOrName === 'string' ? typeObjOrName : (typeObjOrName.name || typeObjOrName.code || '');
    return String(s || '').replace(/\s+/g, '_').replace(/[^A-Za-z0-9_]/g, '').toUpperCase();
  }
  return '';
}

function normaliseFixtureToMatchDoc(fixture) {
  if (!fixture) return null;

  // --- IDs & datetime ---
  const match_id = Number(fixture.id);
  // Use robust parse to avoid ambiguous timezone parsing.
  const date = fixture.starting_at ? parseProviderDate(fixture.starting_at) : null;
  // fallback to now if no date provided
  const safeDate = date || new Date();

  // --- Teams (participants) ---
  let homeName = null;
  let awayName = null;
  let homeId = null;
  let awayId = null;

  const parts = fixture.participants?.data || fixture.participants || [];
  if (Array.isArray(parts) && parts.length) {
    const home = parts.find(p => p?.meta?.location === 'home') || parts[0];
    const away = parts.find(p => p?.meta?.location === 'away') || parts[1] || parts[0];

    homeName = home?.name || home?.short_code || null;
    awayName = away?.name || away?.short_code || null;

    homeId = home?.id ?? home?.participant_id ?? null;
    awayId = away?.id ?? away?.participant_id ?? null;
  } else {
    // fallback (older shapes)
    homeName = fixture.localteam?.name || fixture.localteam?.short_code || null;
    awayName = fixture.visitorteam?.name || fixture.visitorteam?.short_code || null;
    homeId = fixture.localteam_id ?? null;
    awayId = fixture.visitorteam_id ?? null;
  }

  // keep a copy of participants for diagnostics / mapping
  const participants = Array.isArray(parts) ? parts.map(p => ({ id: p.id ?? p.participant_id, name: p.name || p.short_code || null, meta: p.meta || null })) : [];
  // --- Events ---
  let events = [];
  const evs = fixture.events?.data || fixture.events || [];
  if (Array.isArray(evs)) {
    events = evs.map(e => {
      // Map participant_id to team designation ("home" or "away")
      let team = '';
      const participantId = e.participant_id ?? null;
      if (participantId != null) {
        if (String(participantId) === String(homeId)) {
          team = 'home';
        } else if (String(participantId) === String(awayId)) {
          team = 'away';
        }
      }
      
      return {
        id: e.id ?? null,
        fixture_id: e.fixture_id ?? fixture.id ?? null,
        period_id: e.period_id ?? null,
        detailed_period_id: e.detailed_period_id ?? null,
        participant_id: participantId,
        section: e.section ?? null,
        minute: e.minute ?? e.minute_extended ?? null,
        extra_minute: e.extra_minute ?? e.added_time ?? null,
        type_id: e.type_id ?? e.type?.id ?? null,
        type: mapEventType(e.type_id ?? e.type?.id ?? null, e.type ?? e.type_name ?? e.type?.name),
        sub_type_id: e.sub_type_id ?? e.subtype?.id ?? null,
        sub_type: e.sub_type ?? e.subtype?.name ?? null,
        player_id: e.player_id ?? e.player?.id ?? null,
        player_name: e.player_name ?? e.player?.name ?? '',
        related_player_id: e.related_player_id ?? e.related_player?.id ?? null,
        related_player_name: e.related_player_name ?? e.related_player?.name ?? '',
        player: e.player_name ?? e.player?.name ?? '',
        related_player: e.related_player_name ?? e.related_player?.name ?? '',
        team: team, // Add team field based on participant_id mapping
        injured: e.injured ?? null,
        on_bench: e.on_bench ?? false,
        coach_id: e.coach_id ?? null,
        sort_order: e.sort_order ?? null,
        result: e.result ?? null,
        info: e.info ?? e.details ?? e.reason ?? '',
        addition: e.addition ?? null,
        rescinded: e.rescinded ?? null
      };
    });
  }

  // --- Lineups ---
  let lineup = { home: [], away: [] };
  // Sportmonks may include lineup under fixture.lineup or fixture.lineup?.data or under 'lineup'
  const lups = fixture.lineup?.data || fixture.lineup || fixture.lineups || fixture.lineups?.data || [];
  // helper: extract rating value from a "details" array for lineup entries
  const extractRating = (details) => {
    if (!details || !Array.isArray(details)) return null;
    for (const d of details) {
      const typeId = d.type_id ?? d.type?.id ?? null;
      const typeCode = d.type?.code || (d.type?.name || '').toLowerCase();
      if (typeId === 118 || String(typeCode).toLowerCase().includes('rating')) {
        const v = d.data?.value ?? d.value ?? null;
        if (v == null) continue;
        const n = Number(v);
        if (!Number.isNaN(n)) return n;
      }
    }
    return null;
  };

  if (Array.isArray(lups) && lups.length) {
    // Avoid persisting lineups for fixtures that are many hours away.
    // Some provider feeds include tentative lineups well in advance; we only
    // accept/persist lineup data when the fixture is within a reasonable
    // pre-match window. This prevents premature/incorrect lineups being stored.
    const now = new Date();
    const maxHours = Number(process.env.PREMATCH_MAX_HOURS || 6); // default 6 hours
    const hoursToKickoff = date ? ((date.getTime() - now.getTime()) / (1000 * 60 * 60)) : 0;
    // If kickoff is further in the future than the configured window, skip lineups.
    if (hoursToKickoff > maxHours) {
      // skip processing lineup details for distant fixtures
      // (leave lineup as empty arrays)
    } else {
    for (const group of lups) {
      // Support two common shapes:
      // 1) grouped: group has team_id and players array
      // 2) flat: each entry represents a player and includes team_id/player_id
      if (Array.isArray(group.players)) {
        // Determine team id for this group with several fallbacks.
        const groupTeamId = group.team_id ?? group.teamId ?? null;
        const teamIsHome = (groupTeamId != null && homeId != null && String(groupTeamId) === String(homeId))
          || (groupTeamId != null && fixture.localteam_id != null && String(groupTeamId) === String(fixture.localteam_id))
          || (groupTeamId != null && fixture.home_team_id != null && String(groupTeamId) === String(fixture.home_team_id))
          || String(group.type || '').toLowerCase().includes('home');
        const arr = (teamIsHome ? lineup.home : lineup.away);
        for (const p of group.players) {
          const rating = extractRating(p.details || p.player?.details || p.stats || p.details?.data);
          arr.push({
            player_id: p.player_id ?? p.player?.id ?? p.id,
            team_id: p.team_id ?? group.team_id ?? null,
            player_name: p.player?.name || p.player_name || p.name || '',
            position_id: p.position ?? p.position_id ?? null,
            formation_field: p.formation_field ?? null,
            formation_position: p.formation_position ?? p.role ?? null,
            jersey_number: p.jersey_number ?? p.number ?? null,
            type_id: p.type_id ?? null,
            rating: rating,
          });
        }
      } else {
        // flat player entry
        const groupTeamId = group.team_id ?? group.teamId ?? null;
        const teamIsHome = (groupTeamId != null && homeId != null && String(groupTeamId) === String(homeId))
          || (groupTeamId != null && fixture.localteam_id != null && String(groupTeamId) === String(fixture.localteam_id))
          || (groupTeamId != null && fixture.home_team_id != null && String(groupTeamId) === String(fixture.home_team_id))
          || String(group.type || '').toLowerCase().includes('home');
        const arr = (teamIsHome ? lineup.home : lineup.away);
        const rating = extractRating(group.details || group.player?.details || group.stats || group.details?.data);
        arr.push({
          player_id: group.player_id ?? group.player?.id ?? group.id,
          team_id: group.team_id ?? null,
          player_name: group.player_name || group.player?.display_name || group.player?.name || group.name || '',
          position_id: group.position_id ?? group.position ?? null,
          formation_field: group.formation_field ?? null,
          formation_position: group.formation_position ?? group.formation_position ?? null,
          jersey_number: group.jersey_number ?? group.number ?? null,
          type_id: group.type_id ?? null,
          rating: rating,
        });
      }
    }
  }
  }

  // --- Derive small player_stats from events if not present in fixture statistics ---
  const playerStatsMap = {}; // name -> stats

  // helper to ensure map entry
  const ensure = (name) => {
    if (!name) return null;
    if (!playerStatsMap[name]) {
      playerStatsMap[name] = {
        player: name,
        goals: 0,
        shots_on_target: 0,
        shots: 0,
        assists: 0,
        minutes_played: null,
        rating: null,
        xg: null,
      };
    }
    return playerStatsMap[name];
  };

  for (const e of events) {
    const p = e.player && String(e.player).trim();
    if (!p) continue;
    const stat = ensure(p);
    // Normalize event type to a lowercase string safely. e.type may be an
    // object (e.g., { id, name }) or a string depending on provider shape.
    let t = '';
    if (e.type) {
      if (typeof e.type === 'string') t = e.type;
      else if (typeof e.type === 'object' && e.type.name) t = e.type.name;
      else t = String(e.type);
    } else {
      t = e.type_name || '';
    }
    t = String(t).toLowerCase();

    // consider common type names returned by Sportmonks
    if (t.includes('goal')) {
      stat.goals = (stat.goals || 0) + 1;
      // sometimes 'result' like "1-0" indicates a shot on target that became a goal
      stat.shots_on_target = (stat.shots_on_target || 0) + 1;
      stat.shots = (stat.shots || 0) + 1;
    } else if (t.includes('shot')) {
      stat.shots = (stat.shots || 0) + 1;
      // if event.info contains 'on target' we count it
      if ((e.info || '').toLowerCase().includes('on target') || (e.result || '').match(/\d-\d/)) {
        stat.shots_on_target = (stat.shots_on_target || 0) + 1;
      }
    } else if (t.includes('assist')) {
      stat.assists = (stat.assists || 0) + 1;
    } else if (t.includes('substitution')) {
      // could infer minutes_played if you had sub minute info
    }
  }

  // If Sportmonks provides detailed player statistics (e.g., fixture.statistics)
  // there are several common shapes: fixture.statistics.data (array of groups),
  // or fixture.statistics (array). Each group often contains a 'type' object (id/code/name)
  // and a players array with numeric fields. We should merge these numeric stats into
  // our small player_stats map, preferring explicit numeric values from provider.
  const statsGroups = Array.isArray(fixture.statistics?.data)
    ? fixture.statistics.data
    : Array.isArray(fixture.statistics)
    ? fixture.statistics
    : [];

  if (Array.isArray(statsGroups) && statsGroups.length) {
    for (const group of statsGroups) {
      // optional: if group.type exists we could filter to particular types (e.g., "default")
      const players = Array.isArray(group?.players) ? group.players : [];
      for (const p of players) {
        const name = p.player?.name || p.player_name || p.name;
        if (!name) continue;
        const dest = ensure(name);

        // provider may place numeric fields at top-level or nested under player.statistics or stats
        const sources = [p, p.player || {}, p.player?.statistics || {}, p.statistics || {}, p.stats || {}];
        // helper to pick numeric value from possible keys
        const pick = (keys) => {
          for (const src of sources) {
            for (const k of keys) {
              if (src && src[k] != null && !Number.isNaN(Number(src[k]))) return Number(src[k]);
            }
          }
          return null;
        };

        const g = pick(['goals', 'goals_scored', 'goal', 'goals_total']);
        if (g != null) dest.goals = g;
        const s = pick(['shots', 'shots_total']);
        if (s != null) dest.shots = s;
        const sot = pick(['shots_on_target', 'shots_on_target_total', 'shots_on_target']);
        if (sot != null) dest.shots_on_target = sot;
        const a = pick(['assists', 'assist']);
        if (a != null) dest.assists = a;
        const r = pick(['rating', 'player_rating', 'rating_total']);
        if (r != null) dest.rating = r;
        const xg = pick(['xg', 'expected_goals']);
        if (xg != null) dest.xg = xg;
        const mins = pick(['minutes_played', 'minutes', 'time']);
        if (mins != null) dest.minutes_played = mins;
      }
    }
  }

  const player_stats = Object.values(playerStatsMap); // array of small stats



// --- Score ---
function parseScoreString(s) {
  if (!s) return null;
  const m = String(s).match(/(\d+)\s*[-:]\s*(\d+)/);
  if (!m) return null;
  return { home: Number(m[1]), away: Number(m[2]) };
}

let homeScore = 0;
let awayScore = 0;

const scores = fixture.scores;

// 1) canonical numeric fields
if (scores?.localteam_score != null && scores?.visitorteam_score != null) {
  homeScore = Number(scores.localteam_score);
  awayScore = Number(scores.visitorteam_score);
} else if (Array.isArray(scores?.data) && scores.data.length) {
  // 2) v3 often provides an array with descriptions like "current", "ft", etc.
  const pick =
    scores.data.find(s => (s.description || '').toLowerCase() === 'current') ||
    scores.data.find(s => (s.description || '').toLowerCase() === 'ft') ||
    scores.data[scores.data.length - 1];

  if (pick) {
    if (pick.localteam_score != null && pick.visitorteam_score != null) {
      homeScore = Number(pick.localteam_score);
      awayScore = Number(pick.visitorteam_score);
    } else if (pick.score) {
      const ps = parseScoreString(pick.score);
      if (ps) { homeScore = ps.home; awayScore = ps.away; }
    }
  }
} else if (Array.isArray(scores) && scores.length) {
  // 2b) v3 direct scores array with participant_id and score.goals structure
  const currentScores = scores.filter(s => (s.description || '').toLowerCase() === 'current');
  if (currentScores.length >= 2) {
    // Find home and away scores by participant role
    const homeScoreEntry = currentScores.find(s => s.score?.participant === 'home');
    const awayScoreEntry = currentScores.find(s => s.score?.participant === 'away');
    
    if (homeScoreEntry?.score?.goals != null && awayScoreEntry?.score?.goals != null) {
      homeScore = Number(homeScoreEntry.score.goals);
      awayScore = Number(awayScoreEntry.score.goals);
    }
  }
  
  // Fallback: try FT or latest score entries if current not available
  if (homeScore === 0 && awayScore === 0) {
    const ftScores = scores.filter(s => (s.description || '').toLowerCase() === 'ft');
    const targetScores = ftScores.length ? ftScores : scores.slice(-2);
    
    const homeScoreEntry = targetScores.find(s => s.score?.participant === 'home');
    const awayScoreEntry = targetScores.find(s => s.score?.participant === 'away');
    
    if (homeScoreEntry?.score?.goals != null && awayScoreEntry?.score?.goals != null) {
      homeScore = Number(homeScoreEntry.score.goals);
      awayScore = Number(awayScoreEntry.score.goals);
    }
  }
} else {
  // 3) fallbacks some feeds use, e.g., ft_score / ht_score strings
  const ft = scores?.ft_score || scores?.fulltime || scores?.final || fixture?.result_info?.ft_score;
  const parsed = parseScoreString(ft);
  if (parsed) { homeScore = parsed.home; awayScore = parsed.away; }
}

// 4) FINAL FALLBACK: derive from last event's result ("0-3")
// Always look for the latest event that carries a cumulative result string
// and prefer it when it appears to be at least as up-to-date as provider scores.
if (Array.isArray(events) && events.length) {
  const withResult = [...events].reverse().find(e => typeof e.result === 'string' && /(\d+)\s*[-:]\s*(\d+)/.test(e.result));
  if (withResult) {
    const ps = parseScoreString(withResult.result);
    if (ps) {
      // prefer event-derived score when provider score is missing, or when
      // the event-derived total goals is >= provider total (covers cases
      // where provider score may be stale and missing a later goal).
      const providerTotal = Number.isFinite(homeScore) && Number.isFinite(awayScore) ? (homeScore + awayScore) : 0;
      const eventTotal = (ps.home || 0) + (ps.away || 0);
      if (providerTotal === 0 || eventTotal >= providerTotal) {
        homeScore = ps.home;
        awayScore = ps.away;
      }
    }
  }
}




  // --- Live-ish fields (SCOPE THEM INSIDE THE FUNCTION) ---
  let status = 'not_started';
  let status_code = '';
  let minute = null;
  let added_time = null;
  // periodInfo will hold inplay period fields (minutes, seconds, ticking, counts_from) when available
  let periodInfo = null;

  // Prefer explicit provider status names/codes when present, then map to our
  // canonical values. SportMonks may provide state, status, or time.status.
  const provStatus = fixture?.state?.name || fixture?.status?.name || fixture?.time?.status || '';
  const provStatusCode = fixture?.state?.short_name || fixture?.status?.short_name || fixture?.time?.status_code || '';

  // provider state object - prefer fixture.state if present, else build from available pieces
  const match_status = (fixture && fixture.state)
    ? (fixture.state || {})
    : (fixture && (fixture.status || fixture.time))
      ? {
          id: fixture.state?.id ?? null,
          state: fixture.time?.status ?? fixture.status?.name ?? fixture.state?.name ?? '',
          name: fixture.status?.name ?? fixture.state?.name ?? fixture.time?.status ?? '',
          short_name: fixture.status?.short_name ?? fixture.state?.short_name ?? fixture.time?.status_code ?? '',
          developer_name: fixture.status?.developer_name ?? fixture.state?.developer_name ?? ''
        }
      : { id: null, state: '', name: '', short_name: '', developer_name: '' };

  status_code = provStatusCode || '';

  // Map common provider values into our canonical set
  const s = (String(provStatus || '').toLowerCase());
  if (s.includes('postpon') || s.includes('ppd') || s.includes('cancel')) {
    status = 'postponed';
  } else if (s.includes('live') || s.includes('1h') || s.includes('2h') || s.includes('et') || s.includes('pen')) {
    status = 'live';
  } else if (s.includes('finished') || s.includes('ft') || s.includes('fulltime')) {
    status = 'finished';
  } else {
    // default when not explicitly live/finished/postponed
    status = 'not_started';
  }

  if (fixture?.time) {
    minute = Number(fixture.time.minute ?? fixture.time.current ?? null);
    added_time = Number(fixture.time.added_time ?? fixture.time.extra_minute ?? null);
  }

  // Prefer inplay 'minutes' from fixture.periods when available (returned by include=periods / inplay)
  const periodsForMinute = fixture.periods?.data || fixture.periods || [];
  if (Array.isArray(periodsForMinute) && periodsForMinute.length) {
    // Prefer a ticking/active period first
    const ticking = periodsForMinute.find(p => p && (p.ticking === true || p.ticking));
    const best = ticking || [...periodsForMinute].reverse().find(p => p && (p.minutes != null));
    if (best) {
      periodInfo = {
        minutes: Number.isFinite(Number(best.minutes)) ? Number(best.minutes) : null,
        seconds: Number.isFinite(Number(best.seconds)) ? Number(best.seconds) : null,
        ticking: Boolean(best.ticking),
        counts_from: best.counts_from ?? null,
        type_id: best.type_id ?? null,
      };
      // prefer period minutes as our canonical minute when available
      if (periodInfo.minutes != null) minute = periodInfo.minutes;
    }
  }

  // Fallback: some SportMonks payloads include stoppage/injury time per period
  // under fixture.periods[].time_added (example provided by user). Use that
  // when fixture.time doesn't supply added_time.
  if (!Number.isFinite(added_time) || added_time === null) {
    const periods = fixture.periods?.data || fixture.periods || [];
    if (Array.isArray(periods) && periods.length) {
      // Prefer second-half period (type_id === 2) if it has time_added
      let pick = periods.find(p => p && (p.type_id === 2 || (p.description || '').toLowerCase().includes('2nd')) && Number.isFinite(p.time_added) && p.time_added > 0);
      // Otherwise pick the last period that has a numeric time_added
      if (!pick) pick = [...periods].reverse().find(p => p && Number.isFinite(p.time_added) && p.time_added > 0);
      if (pick) added_time = Number(pick.time_added);
    }
  }

  // --- Build document ---
  // map comments (some SportMonks payloads include fixture.comments or fixture.comments.data)
  const comments = (fixture.comments && (Array.isArray(fixture.comments.data) ? fixture.comments.data : fixture.comments)) || [];
  // Build nested match_info object when provider includes related objects
  const match_info = {
    starting_at: safeDate,
    starting_at_timestamp: Number.isFinite(safeDate?.getTime()) ? Math.floor(safeDate.getTime() / 1000) : null,
    venue: null,
    referee: null,
    season: null,
    league: null,
    minute: Number.isFinite(minute) ? minute : null,
    time_added: { first_half: null, second_half: null },
    period: periodInfo,
  };

  // map provider venue if present (fixture.venue or fixture.venue.data)
  const v = fixture.venue?.data || fixture.venue || fixture.venues?.data || fixture.venues;
  if (v) {
    // v might be array or object
    const ven = Array.isArray(v) ? v[0] : v;
    if (ven) {
      match_info.venue = {
        id: ven.id ?? null,
        name: ven.name ?? ven.venue_name ?? null,
        address: ven.address ?? null,
        capacity: ven.capacity ?? null,
        image_path: ven.image_path ?? null,
        city_name: ven.city_name ?? ven.city ?? null,
      };
    }
  }

  // map provider referee if present (fixture.referee or fixture.referee.data)
  const r = fixture.referee?.data || fixture.referee;
  if (r) {
    const ref = Array.isArray(r) ? r[0] : r;
    if (ref) {
      match_info.referee = {
        id: ref.id ?? null,
        name: ref.name ?? ref.display_name ?? null,
        common_name: ref.common_name ?? null,
        firstname: ref.firstname ?? null,
        lastname: ref.lastname ?? null,
        image_path: ref.image_path ?? null,
      };
    }
  }

  // map season
  const sObj = fixture.season?.data || fixture.season;
  if (sObj) {
    const srow = Array.isArray(sObj) ? sObj[0] : sObj;
    if (srow) {
      match_info.season = {
        id: srow.id ?? null,
        name: srow.name ?? null,
        is_current: srow.is_current ?? srow.current ?? false,
        starting_at: srow.starting_at ?? null,
        ending_at: srow.ending_at ?? null,
      };
    }
  }

  // map league
  const lObj = fixture.league?.data || fixture.league;
  if (lObj) {
    const lrow = Array.isArray(lObj) ? lObj[0] : lObj;
    if (lrow) {
      match_info.league = {
        id: lrow.id ?? null,
        name: lrow.name ?? null,
        short_code: lrow.short_code ?? null,
        image_path: lrow.image_path ?? null,
        country_id: lrow.country_id ?? null,
      };
    }
  }

  // map stage (cup competition stages like "3rd Round", "Quarter-finals", etc.)
  const stageObj = fixture.stage?.data || fixture.stage;
  if (stageObj) {
    const stageRow = Array.isArray(stageObj) ? stageObj[0] : stageObj;
    if (stageRow) {
      match_info.stage = {
        id: stageRow.id ?? fixture.stage_id ?? null,
        name: stageRow.name ?? null,
        type: stageRow.type?.name ?? stageRow.type ?? null,
      };
    }
  } else if (fixture.stage_id) {
    // Fallback: if we have stage_id but no stage object
    match_info.stage = {
      id: fixture.stage_id,
      name: null,
      type: null,
    };
  }

  // map round (specific round within a stage)  
  const roundObj = fixture.round?.data || fixture.round;
  if (roundObj) {
    const roundRow = Array.isArray(roundObj) ? roundObj[0] : roundObj;
    if (roundRow) {
      match_info.round = {
        id: roundRow.id ?? fixture.round_id ?? null,
        name: roundRow.name ?? null,
      };
    }
  } else if (fixture.round_id) {
    // Fallback: if we have round_id but no round object
    match_info.round = {
      id: fixture.round_id,
      name: null,
    };
  }

  // populate time_added per half if periods provide time_added info
  const periods = fixture.periods?.data || fixture.periods || [];
  if (Array.isArray(periods) && periods.length) {
    for (const p of periods) {
      try {
        if (p && Number.isFinite(p.type_id)) {
          // type_id 1 -> first half, 2 -> second half (heuristic)
          if (Number(p.type_id) === 1 && Number.isFinite(p.time_added)) match_info.time_added.first_half = Number(p.time_added);
          if (Number(p.type_id) === 2 && Number.isFinite(p.time_added)) match_info.time_added.second_half = Number(p.time_added);
        }
      } catch (e) {}
    }
  }

  // Process team-level match statistics
  const statistics = { home: [], away: [] };
  
  // Handle both fixture.statistics and fixture.statistics.data formats
  const statsData = Array.isArray(fixture.statistics?.data) 
    ? fixture.statistics.data 
    : Array.isArray(fixture.statistics) 
    ? fixture.statistics 
    : [];

  if (statsData.length > 0) {
    for (const statGroup of statsData) {
      // Each stat group can contain team-level statistics
      if (statGroup.participant_id && statGroup.value != null) {
        const statEntry = {
          type_id: statGroup.type_id || null,
          type: statGroup.type?.name || statGroup.type?.code || 'Unknown',
          value: statGroup.value,
          participant_id: statGroup.participant_id
        };
        
        // Assign to home or away based on participant_id
        if (statGroup.participant_id === homeId) {
          statistics.home.push(statEntry);
        } else if (statGroup.participant_id === awayId) {
          statistics.away.push(statEntry);
        }
      }
    }
  }

  const doc = {
    match_id,
    date: safeDate,
    home_team: homeName || 'Home',
    away_team: awayName || 'Away',
    home_team_id: homeId,
    away_team_id: awayId,
    home_team_slug: slugify(homeName || 'Home'),
    away_team_slug: slugify(awayName || 'Away'),
    score: { home: homeScore, away: awayScore },
    comments,
    events,
    player_stats,         // <<< new
  // legacy grouped shape used in many places
  lineup,
    // flattened canonical lineups array: each entry represents one player with optional details (ratings etc)
    lineups: (function buildFlattenedLineups() {
      try {
        const out = [];
        const pushFrom = (arr, teamId) => {
          for (const p of (arr || [])) {
            const playerId = p.player_id ?? null;
            const team_id = p.team_id ?? teamId ?? null;
            const details = [];
            // If a rating was extracted earlier, convert into a details entry
            if (p.rating != null) {
              details.push({ id: null, fixture_id: match_id || null, player_id: playerId, team_id: team_id, lineup_id: null, type_id: 118, data: { value: p.rating } });
            }
            out.push({
              player_id: playerId,
              team_id: team_id,
              player_name: p.player_name || p.name || p.player || '',
              position_id: p.position_id ?? p.position ?? null,
              formation_field: p.formation_field ?? null,
              formation_position: p.formation_position ?? p.role ?? null,
              jersey_number: p.jersey_number ?? p.number ?? null,
              type_id: p.type_id ?? null,
              details: details,
            });
          }
        };
        pushFrom(lineup.home || [], homeId);
        pushFrom(lineup.away || [], awayId);
        return out;
      } catch (e) { return []; }
    })(),
    participants,
    player_ratings: [],   // keep as is or copy if available
    statistics,           // team-level match statistics
    player_of_the_match: '',
    report: '',
    status,
    status_code,
    match_status,
    minute: Number.isFinite(minute) ? minute : null,
    added_time: Number.isFinite(added_time) ? added_time : null,
    match_info,
  };


  return doc;
}

module.exports = { normaliseFixtureToMatchDoc, parseProviderDate };
