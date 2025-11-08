/**
 * Local test runner for POTM rating derivation.
 * This script does NOT call external services or load DBs.
 * It replicates the computePotmFromRatings / computeGlobalPotmFromRatings
 * and findRatingForPlayer logic from controllers/reportController.js
 * and runs them against a sample match (match_id: 19431868).
 */

function computePotmFromRatings(match) {
  const ratings = Array.isArray(match.player_ratings) ? match.player_ratings.slice() : [];
  const homeId = match.home_team_id ?? match.homeId ?? (match.teams && match.teams.home && match.teams.home.team_id) ?? null;
  const awayId = match.away_team_id ?? match.awayId ?? (match.teams && match.teams.away && match.teams.away.team_id) ?? null;
  const normalise = (r) => {
    if (!r) return null;
    const name = r.player || r.player_name || r.name || r.playerName || null;
    const ratingRaw = (r.rating !== undefined && r.rating !== null) ? r.rating : (r.value !== undefined && r.value !== null ? r.value : null);
    const rating = (ratingRaw !== null && !isNaN(Number(ratingRaw))) ? Number(ratingRaw) : null;
    const team = r.team_id ?? r.team ?? r.teamId ?? null;
    const player_id = r.player_id || r.playerId || r.id || null;
    return { name, rating, team, player_id };
  };

  const numeric = ratings.slice().map(r => ({ raw: r, norm: normalise(r) })).filter(x => x.norm && x.norm.rating !== null).sort((a,b) => (b.norm.rating - a.norm.rating));
  const result = { home: { player: null, rating: null, reason: null }, away: { player: null, rating: null, reason: null } };

  for (const entry of numeric) {
    const r = entry.raw;
    const norm = entry.norm;
    if (norm.team !== undefined && norm.team !== null) {
      if (result.home.player === null && String(norm.team) === String(homeId)) {
        result.home = { player: norm.name || null, rating: norm.rating, reason: norm.rating !== null ? `Highest rating (${norm.rating})` : null };
      }
      if (result.away.player === null && String(norm.team) === String(awayId)) {
        result.away = { player: norm.name || null, rating: norm.rating, reason: norm.rating !== null ? `Highest rating (${norm.rating})` : null };
      }
    }
    if (result.home.player !== null && result.away.player !== null) break;
  }

  const resolveFromLineup = (teamSide, sideId) => {
    if (!match.lineup) return null;
    const all = (match.lineup.home || []).concat(match.lineup.away || []);
    if (sideId && Array.isArray(ratings)) {
      for (const r of ratings) {
        const norm = normalise(r);
        if (!norm) continue;
        if (String(norm.team) === String(sideId) && norm.player_id) {
          const found = all.find(p => String(p.player_id) === String(norm.player_id));
          if (found) return { player: found.player_name || found.name || norm.name || null, rating: norm.rating };
        }
      }
    }
    for (const p of all) {
      const pRating = (p.rating !== undefined && p.rating !== null && !isNaN(Number(p.rating))) ? Number(p.rating) : null;
      if (pRating !== null) {
        if (teamSide.rating !== null && Math.abs(teamSide.rating - pRating) < 0.001) {
          return { player: p.player_name || p.name || null, rating: pRating };
        }
      }
    }
    return null;
  };

  if ((result.home.player === null || result.home.rating === null) && match.lineup) {
    const resolved = resolveFromLineup(result.home, homeId);
    if (resolved) result.home = { player: resolved.player || result.home.player, rating: resolved.rating ?? result.home.rating, reason: result.home.reason || (resolved.rating !== null ? `Highest rating (${resolved.rating})` : null) };
  }
  if ((result.away.player === null || result.away.rating === null) && match.lineup) {
    const resolved2 = resolveFromLineup(result.away, awayId);
    if (resolved2) result.away = { player: resolved2.player || result.away.player, rating: resolved2.rating ?? result.away.rating, reason: result.away.reason || (resolved2.rating !== null ? `Highest rating (${resolved2.rating})` : null) };
  }

  return result;
}

function computeGlobalPotmFromRatings(match) {
  const ratings = Array.isArray(match.player_ratings) ? match.player_ratings.slice() : [];
  const normalise = (r) => {
    if (!r) return null;
    const name = r.player || r.player_name || r.name || r.playerName || null;
    const ratingRaw = (r.rating !== undefined && r.rating !== null) ? r.rating : (r.value !== undefined && r.value !== null ? r.value : null);
    const rating = (ratingRaw !== null && !isNaN(Number(ratingRaw))) ? Number(ratingRaw) : null;
    const player_id = r.player_id || r.playerId || r.id || null;
    return { name, rating, player_id };
  };
  let best = null;
  for (const r of ratings) {
    const norm = normalise(r);
    if (!norm) continue;
    if (norm.rating !== null) {
      if (!best || (norm.rating > best.rating)) best = { player: norm.name || null, rating: norm.rating, player_id: norm.player_id };
    }
  }
  if ((!best || !best.player) && match.lineup) {
    const all = (match.lineup.home || []).concat(match.lineup.away || []);
    for (const p of all) {
      const pRating = (p.rating !== undefined && p.rating !== null && !isNaN(Number(p.rating))) ? Number(p.rating) : null;
      if (pRating !== null) {
        if (!best || pRating > (best.rating || -Infinity)) best = { player: p.player_name || p.name || null, rating: pRating, player_id: p.player_id || null };
      }
    }
  }
  if (!best) return { player: null, rating: null, reason: null };
  return { player: best.player || null, rating: best.rating ?? null, reason: best.rating !== null ? `Highest rating (${best.rating})` : null };
}

function findRatingForPlayer(match, playerNameOrId) {
  if (!match) return null;
  const nameKey = playerNameOrId ? String(playerNameOrId).toLowerCase().trim() : null;
  if (Array.isArray(match.player_ratings) && match.player_ratings.length) {
    for (const r of match.player_ratings) {
      const rName = (r.player || r.player_name || '').toString().toLowerCase();
      const pid = r.player_id || r.playerId || r.id || null;
      if ((nameKey && rName === nameKey) || (pid && String(pid) === String(playerNameOrId))) {
        const rating = (r.rating !== undefined && r.rating !== null && !isNaN(Number(r.rating))) ? Number(r.rating) : null;
        if (rating !== null) return rating;
      }
    }
  }
  const lineupFromNested = (match.lineup && ((match.lineup.home || []).concat(match.lineup.away || []))) || [];
  const lineupRaw = Array.isArray(match.lineups) ? match.lineups.slice() : [];
  const lineupAll = lineupFromNested.concat(lineupRaw || []);
  if (Array.isArray(lineupAll) && lineupAll.length) {
    for (const p of lineupAll) {
      const pName = (p.player_name || p.name || p.player || '').toString().toLowerCase();
      if (nameKey && pName === nameKey) {
        const rating = (p.rating !== undefined && p.rating !== null && !isNaN(Number(p.rating))) ? Number(p.rating) : null;
        if (rating !== null) return rating;
        const pid = p.player_id || p.playerId || p.id || null;
        if (pid && Array.isArray(match.player_ratings)) {
          const found = match.player_ratings.find(rr => rr.player_id && String(rr.player_id) === String(pid) && rr.rating !== undefined && rr.rating !== null && !isNaN(Number(rr.rating)));
          if (found) return Number(found.rating);
        }
      }
    }
    if (playerNameOrId && !isNaN(Number(playerNameOrId))) {
      const pidKey = String(playerNameOrId);
      if (Array.isArray(match.player_ratings)) {
        const found = match.player_ratings.find(rr => rr.player_id && String(rr.player_id) === pidKey && rr.rating !== undefined && rr.rating !== null && !isNaN(Number(rr.rating)));
        if (found) return Number(found.rating);
      }
      const foundLine = lineupAll.find(p => (p.player_id && String(p.player_id) === pidKey));
      if (foundLine) {
        const rating = (foundLine.rating !== undefined && foundLine.rating !== null && !isNaN(Number(foundLine.rating))) ? Number(foundLine.rating) : null;
        if (rating !== null) return rating;
      }
    }
  }
  return null;
}

// Sample match fixture for 19431868
const sampleMatch = {
  match_id: 19431868,
  date: '2025-10-22T17:00:00.000Z',
  home_team_id: 100,
  away_team_id: 200,
  home_team: 'Example FC',
  away_team: 'Opponents United',
  player_ratings: [
    { player: 'Example Player', player_id: 10, team_id: 100, rating: 7.5 },
    { player: 'Another Star', player_id: 11, team_id: 100, rating: 7.2 },
    { player: 'Away Top', player_id: 20, team_id: 200, rating: 7.9 }
  ],
  lineup: {
    home: [ { player_id: 10, player_name: 'Example Player', rating: 7.5 } ],
    away: [ { player_id: 20, player_name: 'Away Top', rating: 7.9 } ]
  }
};

console.log('Sample match id:', sampleMatch.match_id);
console.log('\ncomputePotmFromRatings result:');
console.log(JSON.stringify(computePotmFromRatings(sampleMatch), null, 2));

console.log('\ncomputeGlobalPotmFromRatings result:');
console.log(JSON.stringify(computeGlobalPotmFromRatings(sampleMatch), null, 2));

console.log('\nfindRatingForPlayer("Example Player") =>', findRatingForPlayer(sampleMatch, 'Example Player'));
console.log('findRatingForPlayer(10) =>', findRatingForPlayer(sampleMatch, 10));

// Emulate reportDoc potm building logic used by generateReportFor
const globalPotm = computeGlobalPotmFromRatings(sampleMatch);
let potmForReport = { player: null, rating: null, reason: null, sources: {} };
if (globalPotm && globalPotm.player) potmForReport = { player: globalPotm.player, rating: globalPotm.rating, reason: globalPotm.reason, sources: {} };
if (potmForReport.player && (potmForReport.rating === null || potmForReport.rating === undefined)) {
  const rr = findRatingForPlayer(sampleMatch, potmForReport.player);
  if (rr !== null) potmForReport.rating = rr;
}

console.log('\nFinal potmForReport (emulated):');
console.log(JSON.stringify(potmForReport, null, 2));
