// utils/lineup.js
// Helpers to normalise/partition raw SportMonks lineup payloads into home/away arrays
function normalizeEntry(p) {
  return {
    player_id: p.player_id ?? p.player?.id ?? p.id ?? null,
    team_id: p.team_id ?? p.team?.id ?? null,
    name: p.player_name || (p.player && (p.player.name || p.player.fullname)) || p.name || null,
    number: p.jersey_number ?? p.number ?? null,
    position: p.position_id ?? p.position ?? p.role ?? null
  };
}

function partitionRawLineups(smPayload, matchContext) {
  // smPayload: sportmonks fixture payload
  // matchContext: object containing home_team_id / away_team_id / localteam_id / visitorteam_id etc
  // SportMonks can return a few shapes:
  // - lineups: { data: [ { team_id, players: [...] }, ... ] }
  // - lineup: { data: [ { team_id, players: [...] }, ... ] }
  // - lineups: [ { team_id, players: [...] }, ... ]
  // - or a flat players array in some older shapes
  const raw = smPayload?.lineups?.data || smPayload?.lineups || smPayload?.lineup?.data || smPayload?.lineup || [];

  // Normalize into a flat array of player entries. When entries come grouped by team
  // (group objects with `team_id` and `players`), propagate the group's team id into
  // each player so partitioning by team id is deterministic.
  let entries = [];
  if (Array.isArray(raw)) {
    // If array elements look like groups (have players[]), flatten and propagate team ids
    for (const g of raw) {
      if (g && Array.isArray(g.players)) {
        const gid = g.team_id ?? g.team?.id ?? null;
        for (const p of g.players) {
          // If player entry doesn't include team_id, inject group's id so normalizeEntry picks it up
          const copy = { ...(p || {}) };
          if ((copy.team_id === undefined || copy.team_id === null) && gid != null) copy.team_id = gid;
          entries.push(copy);
        }
      } else if (g && (g.player_id || g.player || g.id)) {
        // already an individual player entry
        entries.push(g);
      }
    }
  } else if (raw && Array.isArray(raw.players)) {
    entries = raw.players.slice();
  } else {
    entries = [];
  }

  // Build home/away id sets from both provided matchContext and the sportmonks payload
  const payloadHomeIds = [smPayload?.home_team_id, smPayload?.localteam_id, smPayload?.home_team?.id, smPayload?.home_team_id];
  const payloadAwayIds = [smPayload?.away_team_id, smPayload?.visitorteam_id, smPayload?.away_team?.id, smPayload?.away_team_id];
  const homeIds = new Set([
    ...(matchContext?.home_team_id ? [matchContext.home_team_id] : []),
    ...(matchContext?.localteam_id ? [matchContext.localteam_id] : []),
    ...(matchContext?.home_team?.id ? [matchContext.home_team.id] : []),
    ...payloadHomeIds
  ].filter(Boolean).map(String));
  const awayIds = new Set([
    ...(matchContext?.away_team_id ? [matchContext.away_team_id] : []),
    ...(matchContext?.visitorteam_id ? [matchContext.visitorteam_id] : []),
    ...(matchContext?.away_team?.id ? [matchContext.away_team.id] : []),
    ...payloadAwayIds
  ].filter(Boolean).map(String));

  const home = [];
  const away = [];

  for (const p of entries) {
    // Normalize common aliases that might contain a team id/object on the player
    if (p && !p.team_id) {
      if (p.team && (p.team.id || p.team.team_id)) p.team_id = p.team.id || p.team.team_id;
      else if (p.player && p.player.team_id) p.team_id = p.player.team_id;
      else if (p.player && p.player.team && (p.player.team.id || p.player.team.team_id)) p.team_id = p.player.team.id || p.player.team.team_id;
    }
    const item = normalizeEntry(p);
    const tId = item.team_id != null ? String(item.team_id) : null;
    if (tId && homeIds.has(tId)) {
      home.push(item);
    } else if (tId && awayIds.has(tId)) {
      away.push(item);
    } else {
      // ambiguous: attempt to infer from player number heuristics (common ranges for home/away are not reliable)
      // Fallback: if the player object contains an explicit `team` or `team_id` string that matches a team name
      // we can try matching by team slug as a last resort.
      let assigned = false;
      const teamName = p.team || (p.team_name || p.team?.name || null);
      if (teamName && typeof teamName === 'string') {
        const slug = String(teamName).toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        // compare against provided matchContext names if available
        const homeSlug = matchContext?.home_team?.slug || (matchContext?.home_team && matchContext.home_team.name ? String(matchContext.home_team.name).toLowerCase().trim().replace(/\s+/g, '-') : null);
        const awaySlug = matchContext?.away_team?.slug || (matchContext?.away_team && matchContext.away_team.name ? String(matchContext.away_team.name).toLowerCase().trim().replace(/\s+/g, '-') : null);
        if (homeSlug && slug === homeSlug) { home.push(item); assigned = true; }
        else if (awaySlug && slug === awaySlug) { away.push(item); assigned = true; }
      }
      if (!assigned) {
        // final fallback: balance sides to avoid skew
        if (home.length <= away.length) home.push(item); else away.push(item);
      }
    }
  }

  return { home, away };
}

module.exports = { partitionRawLineups, normalizeEntry };
