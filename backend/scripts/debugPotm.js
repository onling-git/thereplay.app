#!/usr/bin/env node
// Debug script to run computePotmFromRatings for a given match id
const path = require('path');
const mongoose = require('mongoose');
const db = require('../db/connect');
// ensure models path resolution matches app
const Match = require('../models/Match');

async function computePotmFromRatings(match, verbose = false) {
  const ratings = Array.isArray(match.player_ratings) ? match.player_ratings.slice() : [];
  const homeId = match.home_team_id ?? match.homeId ?? (match.teams && match.teams.home && match.teams.home.team_id) ?? null;
  const awayId = match.away_team_id ?? match.awayId ?? (match.teams && match.teams.away && match.teams.away.team_id) ?? null;
  // Build mapping from lineup (if present) so rating entries can use the same player_name
  const lineupMap = {};
  if (match && (match.lineup || match.lineups)) {
    const all = (match.lineup && ((match.lineup.home || []).concat(match.lineup.away || []))) || (Array.isArray(match.lineups) ? match.lineups : []);
    for (const p of all) {
      if (!p) continue;
      const id = p.player_id ?? p.playerId ?? p.id;
      if (id !== undefined && id !== null) lineupMap[String(id)] = p.player_name || p.name || p.player || null;
    }
  }

  // Helper to normalise name and rating from provider shapes. Prefer lineup name if rating lacks one.
  const normalise = (r) => {
    if (!r) return null;
    let name = r.player_name  || r.player || r.name || r.playerName || null;
    const ratingRaw = (r.rating !== undefined && r.rating !== null) ? r.rating : (r.value !== undefined && r.value !== null ? r.value : null);
    const rating = (ratingRaw !== null && !isNaN(Number(ratingRaw))) ? Number(ratingRaw) : null;
    const team = r.team_id ?? r.team ?? r.teamId ?? null;
    const player_id = r.player_id || r.playerId || r.id || null;
    if ((!name || String(name).trim() === '') && player_id && lineupMap[String(player_id)]) {
      name = lineupMap[String(player_id)];
    }
    return { name, rating, team, player_id };
  };

  // verbose dump: incoming values
  if (verbose) {
    console.log('\n[potm-debug] verbose flag:', !!verbose);
    try {
      // build a safe summary of the match for comparison: key list, basic meta, and important arrays (player_ratings, lineup)
      const safeMatch = {
        _id: match._id || null,
        match_id: match.match_id || null,
        date: match.date || null,
        home_team: match.home_team || null,
        away_team: match.away_team || null,
        keys: Object.keys(match || {}),
        player_ratings_count: Array.isArray(match.player_ratings) ? match.player_ratings.length : 0,
        // include a slice of player_ratings to inspect structure
        player_ratings_sample: Array.isArray(match.player_ratings) ? match.player_ratings.slice(0, 50) : [],
        lineup: match.lineup || match.lineups || null,
        score: match.score || null
      };
      console.log('[potm-debug] match summary:', JSON.stringify(safeMatch, null, 2));
    } catch (e) {
      console.log('[potm-debug] failed to stringify match:', e?.message || e);
    }
    console.log('[potm-debug] homeId:', homeId, 'awayId:', awayId);
    console.log('[potm-debug] player_ratings count:', ratings.length);
  }

  // sort by numeric rating descending, treating null/NaN as -Infinity so they fall to the end
  const normalizedAll = ratings.slice().map(r => ({ raw: r, norm: normalise(r) }));
  if (verbose) console.log('[potm-debug] normalized sample:', JSON.stringify(normalizedAll.slice(0,10), null, 2));
  const numeric = normalizedAll.filter(x => x.norm && x.norm.rating !== null).sort((a,b) => (b.norm.rating - a.norm.rating));
  const result = { home: { player: null, rating: null, reason: null }, away: { player: null, rating: null, reason: null } };

  // fast path: pick first matching team entry for each side
  for (const entry of numeric) {
    const r = entry.raw;
    const norm = entry.norm;
    if (verbose) console.log('[potm-debug] checking norm:', JSON.stringify(norm));
    if (norm.team !== undefined && norm.team !== null) {
      if (result.home.player === null && String(norm.team) === String(homeId)) {
        result.home = { player: norm.name || null, rating: norm.rating, reason: norm.rating !== null ? `Highest rating (${norm.rating})` : null };
        if (verbose) console.log('[potm-debug] assigned home from rating:', JSON.stringify(result.home));
      }
      if (result.away.player === null && String(norm.team) === String(awayId)) {
        result.away = { player: norm.name || null, rating: norm.rating, reason: norm.rating !== null ? `Highest rating (${norm.rating})` : null };
        if (verbose) console.log('[potm-debug] assigned away from rating:', JSON.stringify(result.away));
      }
    }
    if (result.home.player !== null && result.away.player !== null) break;
  }

  // If either side is still missing a name but we have a rating, try to resolve the player name from match.lineup by player_id or matching rating
  const resolveFromLineup = (teamSide, sideId) => {
    if (!match.lineup) return;
    const all = (match.lineup.home || []).concat(match.lineup.away || []);
    if (verbose) console.log('[potm-debug] lineup all count:', all.length);
    // try by player_id
    if (sideId && Array.isArray(ratings)) {
      for (const r of ratings) {
        const norm = normalise(r);
        if (!norm) continue;
        if (String(norm.team) === String(sideId) && norm.player_id) {
          const found = all.find(p => String(p.player_id) === String(norm.player_id));
          if (verbose) console.log('[potm-debug] trying resolve by player_id:', norm.player_id, 'found:', !!found);
          if (found) return { player: found.player_name || found.name || norm.name || null, rating: norm.rating };
        }
      }
    }
    // try by rating match
    for (const p of all) {
      const pRating = (p.rating !== undefined && p.rating !== null && !isNaN(Number(p.rating))) ? Number(p.rating) : null;
      if (pRating !== null) {
        // if this player has the same rating as our derived rating, assume it's the same
        if (teamSide.rating !== null && Math.abs(teamSide.rating - pRating) < 0.001) {
          if (verbose) console.log('[potm-debug] resolved by rating match:', teamSide.rating, '==', pRating, 'player:', p.player_name || p.name || null);
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

async function main() {
  const argv = process.argv.slice(2);
  if (!argv.length) {
    console.error('Usage: node debugPotm.js <matchId> [MONGO_URI] [--verbose]');
    process.exit(2);
  }
  const verbose = argv.includes('--verbose') || argv.includes('-v') || process.env.POTM_VERBOSE === '1';
  // first numeric arg is match id
  const idArg = argv.find(a => /^\d+$/.test(String(a)));
  const matchId = idArg ? Number(idArg) : NaN;
  const uriArg = argv.find(a => typeof a === 'string' && (a.startsWith('mongodb://') || a.startsWith('mongodb+srv://')));
  const uri = uriArg || process.env.DBURI || process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    console.error('Provide MongoDB URI as second arg or set DBURI/MONGO_URI env var');
    process.exit(2);
  }
  if (!matchId || isNaN(matchId)) {
    console.error('Provide a numeric matchId as the first argument');
    process.exit(2);
  }

  try {
    await db.connectDB(uri);
    const match = await Match.findOne({ match_id: matchId }).lean();
    if (!match) {
      console.error('Match not found for id', matchId);
      process.exit(1);
    }
  const out = await computePotmFromRatings(match, verbose);
  console.log('POTM result for match', matchId, JSON.stringify(out, null, 2));
  } catch (e) {
    console.error('Error:', e?.message || e);
    process.exit(1);
  } finally {
    await db.closeDB();
  }
}

if (require.main === module) main();

// export computePotmFromRatings so other scripts can reuse the canonical debug implementation
module.exports = { computePotmFromRatings };
