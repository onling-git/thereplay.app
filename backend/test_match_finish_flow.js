// Test the complete post-match flow:
// 1. Match finishes
// 2. Tweets collected automatically
// 3. Reports generated with tweet context
require('dotenv').config();
const mongoose = require('mongoose');

async function testMatchFinishFlow() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const matchId = 19432238;

    console.log('🧪 TESTING POST-MATCH FLOW');
    console.log('='.repeat(80));
    console.log('Simulating: Match just finished → Trigger webhook processing');
    console.log('');
    console.log('This will:');
    console.log('1. ✅ Verify match is finished');
    console.log('2. 🐦 Collect tweets from Twitter (if API configured)');
    console.log('3. 📝 Generate both team reports with tweet context');
    console.log('4. 💾 Save reports to database');
    console.log('');
    console.log('Match ID:', matchId);
    console.log('');

    // Import the webhook processor
    const { processFinishedMatch } = require('./webhooks/matchStatusWebhook');

    // Trigger the complete flow
    console.log('🚀 Triggering webhook processing...\n');
    await processFinishedMatch(matchId);

    console.log('\n' + '='.repeat(80));
    console.log('✅ TEST COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Check the logs above to see:');
    console.log('- How many tweets were collected');
    console.log('- Whether reports were generated successfully');
    console.log('- Any errors encountered');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

testMatchFinishFlow();
