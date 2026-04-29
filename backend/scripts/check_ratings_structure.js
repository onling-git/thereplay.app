// Check player ratings structure for Southampton match
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');

async function checkRatings() {
  try {
    await mongoose.connect(process.env.DBURI);
    
    const match = await Match.findOne({ match_id: 19432224 }).lean();
    
    console.log('=== MATCH TEAMS ===');
    console.log('Home:', match.home_team, '(ID:', match.home_team_id || match.teams?.home?.team_id, ')');
    console.log('Away:', match.away_team, '(ID:', match.away_team_id || match.teams?.away?.team_id, ')');
    
    console.log('\n=== PLAYER RATINGS ===');
    console.log('Total:', match.player_ratings?.length || 0);
    
    if (match.player_ratings && match.player_ratings.length > 0) {
      console.log('\nFirst 5 ratings:');
      match.player_ratings.slice(0, 5).forEach(r => {
        console.log(`\nPlayer: ${r.player}`);
        console.log(`  Rating: ${r.rating}`);
        console.log(`  Team: ${r.team || 'NOT SET'}`);
        console.log(`  Team ID: ${r.team_id || 'NOT SET'}`);
        console.log(`  Source: ${r.source}`);
      });
      
      // Group by team_id
      const byTeamId = {};
      match.player_ratings.forEach(r => {
        const id = r.team_id || 'NO_TEAM_ID';
        byTeamId[id] = (byTeamId[id] || 0) + 1;
      });
      
      console.log('\n=== Ratings by team_id ===');
      Object.entries(byTeamId).forEach(([id, count]) => {
        console.log(`team_id ${id}: ${count} ratings`);
      });
      
      // Find highest rated for each team
      const homeId = match.home_team_id || match.teams?.home?.team_id;
      const awayId = match.away_team_id || match.teams?.away?.team_id;
      
      const homeRatings = match.player_ratings
        .filter(r => r.team_id === homeId && r.rating)
        .sort((a, b) => b.rating - a.rating);
      
      const awayRatings = match.player_ratings
        .filter(r => r.team_id === awayId && r.rating)
        .sort((a, b) => b.rating - a.rating);
      
      console.log(`\n=== Highest Rated (Home team ${homeId}) ===`);
      if (homeRatings.length > 0) {
        console.log(`${homeRatings[0].player}: ${homeRatings[0].rating}`);
      } else {
        console.log('❌ NO RATINGS FOUND');
      }
      
      console.log(`\n=== Highest Rated (Away team ${awayId}) ===`);
      if (awayRatings.length > 0) {
        console.log(`${awayRatings[0].player}: ${awayRatings[0].rating}`);
      } else {
        console.log('❌ NO RATINGS FOUND');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

checkRatings();
