const mongoose = require('mongoose');
require('dotenv').config();
const Match = require('./models/Match');

async function checkMatch() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || process.env.DATABASE_URL;
    if (!uri) {
      console.error('❌ No MongoDB URI found in environment variables');
      console.error('Looking for: DBURI, MONGODB_URI, or DATABASE_URL');
      return;
    }
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    const match = await Match.findOne({ match_id: 19432231 }).lean();
    
    if (!match) {
      console.log('❌ Match 19432231 not found');
      return;
    }

    console.log('\n=== Match Data ===');
    console.log('Match ID:', match.match_id);
    console.log('Teams:', match.teams?.home?.team_name, 'vs', match.teams?.away?.team_name);
    console.log('Score:', match.score);
    console.log('Status:', match.match_status);
    
    console.log('\n=== League/Competition Info ===');
    console.log('match.league:', match.league);
    console.log('match.competition:', match.competition);
    console.log('match.match_info?.league:', match.match_info?.league);
    console.log('match.match_info?.league?.id:', match.match_info?.league?.id);
    console.log('Full match_info:', JSON.stringify(match.match_info, null, 2));
    
    console.log('\n=== Player Ratings ===');
    if (match.player_ratings && match.player_ratings.length > 0) {
      console.log('✅ Has player ratings:', match.player_ratings.length, 'players');
      match.player_ratings.forEach(r => {
        console.log(`  - Player ID ${r.player_id}: ${r.rating}`);
      });
    } else {
      console.log('❌ No player_ratings field or empty');
    }

    console.log('\n=== Player of the Match ===');
    if (match.player_of_the_match) {
      console.log('✅ Has POTM:', match.player_of_the_match);
    } else {
      console.log('❌ No player_of_the_match field');
    }

    console.log('\n=== Lineup Data ===');
    if (match.lineup) {
      if (match.lineup.home) {
        console.log('✅ Home lineup:', match.lineup.home.length, 'players');
        console.log('Sample player:', match.lineup.home[0]);
      }
      if (match.lineup.away) {
        console.log('✅ Away lineup:', match.lineup.away.length, 'players');
      }
    } else {
      console.log('❌ No lineup field');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkMatch();
