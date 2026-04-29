require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

// Copy the POTM functions from reportController
function computePotmFromRatings(match) {
  const ratings = match.player_ratings || [];
  if (!Array.isArray(ratings) || !ratings.length) return { home: null, away: null };

  // Group by team_id
  const byTeam = {};
  for (const r of ratings) {
    if (!r.team_id || r.rating == null || isNaN(Number(r.rating))) continue;
    if (!byTeam[r.team_id]) byTeam[r.team_id] = [];
    byTeam[r.team_id].push(r);
  }

  const result = { home: null, away: null };
  for (const [teamId, teamRatings] of Object.entries(byTeam)) {
    if (!teamRatings.length) continue;
    let best = teamRatings[0];
    for (const r of teamRatings) {
      if (Number(r.rating) > Number(best.rating)) best = r;
    }
    if (best && best.rating != null) {
      const playerName = best.player || best.player_name || null;
      const teamIdNum = Number(teamId);
      
      // Map team_id to home/away (you'd need to adjust this based on your data)
      // For match 19631550: Chelsea=18 (home), Arsenal=19 (away)  
      if (teamIdNum === 18) {
        result.home = { player: playerName, rating: Number(best.rating), reason: `Highest rating (${best.rating})`, sources: { provider: 'sportmonks' } };
      } else if (teamIdNum === 19) {
        result.away = { player: playerName, rating: Number(best.rating), reason: `Highest rating (${best.rating})`, sources: { provider: 'sportmonks' } };
      }
    }
  }

  return result;
}

async function debugPotmSelection() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    
    const match = await Match.findOne({ match_id: 19631550 }).lean();
    
    console.log('=== DEBUGGING POTM SELECTION ===');
    
    // Test the POTM computation
    const derived = computePotmFromRatings(match);
    console.log('Derived POTM:');
    console.log('Home (Chelsea):', derived.home);
    console.log('Away (Arsenal):', derived.away);
    
    // Check team name matching logic
    const targetTeamName = 'Arsenal';
    const tName = String(targetTeamName || '').toLowerCase();
    const homeName = String(match.home_team || '').toLowerCase();
    const awayName = String(match.away_team || '').toLowerCase();
    const nestedHomeName = (match.teams && match.teams.home && String(match.teams.home.team_name || '').toLowerCase()) || '';
    const nestedAwayName = (match.teams && match.teams.away && String(match.teams.away.team_name || '').toLowerCase()) || '';
    const isHomeFocus = (tName && (tName === homeName || tName === nestedHomeName));
    
    console.log('\n=== TEAM MATCHING LOGIC ===');
    console.log('Target team name:', targetTeamName);
    console.log('Target name (lowercase):', tName);
    console.log('Home team name:', homeName);
    console.log('Away team name:', awayName);
    console.log('Is home focus:', isHomeFocus);
    
    const chosen = isHomeFocus ? derived.home : derived.away;
    console.log('\nChosen POTM for', targetTeamName + ':', chosen);
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugPotmSelection();