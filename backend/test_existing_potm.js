require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

// Copy the current computePotmFromRatings function to test it
function computePotmFromRatings(match) {
  const ratings = Array.isArray(match.player_ratings) ? match.player_ratings.slice() : [];
  const homeId = match.home_team_id ?? match.homeId ?? (match.teams && match.teams.home && match.teams.home.team_id) ?? null;
  const awayId = match.away_team_id ?? match.awayId ?? (match.teams && match.teams.away && match.teams.away.team_id) ?? null;
  // Build a quick lookup from match.lineup (if present) so we can resolve player names by id
  const lineupMap = {};
  if (match && match.lineup) {
    const allPlayers = (match.lineup.home || []).concat(match.lineup.away || []);
    for (const p of allPlayers) {
      if (!p) continue;
      const id = (p.player_id ?? p.playerId ?? p.id);
      if (id !== undefined && id !== null) lineupMap[String(id)] = p.player_name || p.name || p.player || null;
    }
  }

  // Helper to normalise name and rating from provider shapes. If the rating item lacks a name
  // but has a player_id that exists in the lineup, prefer the lineup's player_name so shapes match.
  const normalise = (r) => {
    if (!r) return null;
    let name = r.player || r.player_name || r.name || r.playerName || null;
    const ratingRaw = (r.rating !== undefined && r.rating !== null) ? r.rating : (r.value !== undefined && r.value !== null ? r.value : null);
    const rating = (ratingRaw !== null && !isNaN(Number(ratingRaw))) ? Number(ratingRaw) : null;
    const team = r.team_id ?? r.teamId ?? null;
    const player_id = r.player_id || r.playerId || r.id || null;
    // if no name on the rating object, try to resolve from the lineup map using player_id
    if ((!name || String(name).trim() === '') && player_id && lineupMap[String(player_id)]) {
      name = lineupMap[String(player_id)];
    }
    return { name, rating, team, player_id };
  };

  // sort by numeric rating descending, treating null/NaN as -Infinity so they fall to the end
  const numeric = ratings.slice().map(r => ({ raw: r, norm: normalise(r) })).filter(x => x.norm && x.norm.rating !== null).sort((a,b) => (b.norm.rating - a.norm.rating));
  const result = { home: { player: null, rating: null, reason: null }, away: { player: null, rating: null, reason: null } };

  console.log('DEBUG: homeId =', homeId, 'awayId =', awayId);
  console.log('DEBUG: lineupMap has', Object.keys(lineupMap).length, 'entries');
  console.log('DEBUG: ratings count =', ratings.length);
  console.log('DEBUG: numeric count =', numeric.length);

  // fast path: pick first matching team entry for each side
  for (const entry of numeric) {
    const r = entry.raw;
    const norm = entry.norm;
    
    console.log('DEBUG: Checking rating - team:', norm.team, 'name:', norm.name, 'rating:', norm.rating);
    
    if (norm.team !== undefined && norm.team !== null) {
      if (result.home.player === null && String(norm.team) === String(homeId)) {
        result.home = { player: norm.name || null, rating: norm.rating, reason: norm.rating !== null ? `Highest rating (${norm.rating})` : null };
        console.log('DEBUG: Set home POTM:', result.home);
      }
      if (result.away.player === null && String(norm.team) === String(awayId)) {
        result.away = { player: norm.name || null, rating: norm.rating, reason: norm.rating !== null ? `Highest rating (${norm.rating})` : null };
        console.log('DEBUG: Set away POTM:', result.away);
      }
    }
    if (result.home.player !== null && result.away.player !== null) break;
  }

  return result;
}

async function testExistingPotmFunction() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    
    const match = await Match.findOne({ match_id: 19631550 }).lean();
    
    console.log('=== TESTING EXISTING POTM FUNCTION ===');
    console.log('Match teams structure:');
    console.log('- home_team_id:', match.home_team_id);
    console.log('- away_team_id:', match.away_team_id);
    console.log('- teams.home.team_id:', match.teams?.home?.team_id);
    console.log('- teams.away.team_id:', match.teams?.away?.team_id);
    
    const result = computePotmFromRatings(match);
    console.log('\nFinal result:', result);
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testExistingPotmFunction();