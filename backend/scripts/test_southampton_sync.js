// Test script to manually sync Southampton match with detailed logging
require('dotenv').config();
const mongoose = require('mongoose');
const { syncFinishedMatch } = require('../controllers/matchSyncController');

async function testSync() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.DBURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected!\n');

    const matchId = 19432224; // Southampton vs Ipswich
    console.log(`Testing syncFinishedMatch(${matchId})...\n`);
    
    // Call the sync function - this should extract ratings and save them
    const result = await syncFinishedMatch(matchId);
    
    console.log('\n=== SYNC RESULT ===');
    console.log('Success:', !!result);
    
    // Now fetch the match from DB to see what was saved
    const Match = require('../models/Match');
    const match = await Match.findOne({ match_id: matchId });
    
    console.log('\n=== MATCH DATA AFTER SYNC ===');
    console.log('Match ID:', match.match_id);
    console.log('Player Ratings Count:', match.player_ratings?.length || 0);
    
    if (match.player_ratings && match.player_ratings.length > 0) {
      console.log('\n=== PLAYER RATINGS ===');
      match.player_ratings.forEach(r => {
        console.log(`  ${r.player}: ${r.rating} (${r.team || 'unknown team'})`);
      });
    } else {
      console.log('❌ NO PLAYER RATINGS SAVED');
    }
    
    // Check if sources metadata shows what include was used
    if (match.sources?.sportmonks) {
      console.log('\n=== SPORTMONKS FETCH INFO ===');
      console.log('Include used:', match.sources.sportmonks.last_fetched_with_include);
      console.log('Last fetched:', match.sources.sportmonks.last_fetched_at);
    }
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
  }
}

testSync();
