// Regenerate Southampton report locally using controller
require('dotenv').config();
const mongoose = require('mongoose');
const { generateBothReportsV2 } = require('../controllers/reportControllerV2');
const { syncFinishedMatch } = require('../controllers/matchSyncController');

async function regenerate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.DBURI);
    console.log('Connected!\n');

    const matchId = 19432224;
    
    // Step 1: Sync match data (get latest ratings)
    console.log('=== Step 1: Syncing match data ===');
    try {
      await syncFinishedMatch(matchId);
      console.log('✅ Match synced\n');
    } catch (e) {
      console.warn('⚠️  Sync warning:', e.message, '\n');
    }
    
    // Step 2: Generate reports (will auto-collect reporter tweets if needed)
    console.log('=== Step 2: Generating reports ===');
    console.log('This will auto-collect reporter tweets from:');
    console.log('  Southampton: @AlfieHouseEcho, @AlexComber_, @rees_julian, @SaintsExtra');
    console.log('  Ipswich: @mrbail\n');
    
    const results = await generateBothReportsV2(matchId);
    
    console.log('\n=== RESULTS ===');
    console.log('Home report:', results.home?.headline || results.home?.error || 'Generated');
    console.log('Away report:', results.away?.headline || results.away?.error || 'Generated');
    
    if (results.home?.embedded_tweets) {
      console.log(`\nHome report tweets: ${results.home.embedded_tweets.length}`);
    }
    if (results.away?.embedded_tweets) {
      console.log(`Away report tweets: ${results.away.embedded_tweets.length}`);
    }
    
    console.log('\n✅ Report regeneration complete!');
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
  }
}

regenerate();
