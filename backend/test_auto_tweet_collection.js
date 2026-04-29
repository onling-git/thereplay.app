// Test auto tweet collection in report pipeline
require('dotenv').config();
const mongoose = require('mongoose');
const { generateReportPipeline } = require('./services/reportPipeline');

async function testAutoCollection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const matchId = 19432238;
    const teamSlug = 'wrexham';

    console.log('🧪 TESTING AUTO TWEET COLLECTION');
    console.log('='.repeat(80));
    console.log('Match ID:', matchId);
    console.log('Team:', teamSlug);
    console.log('');
    console.log('This test will:');
    console.log('1. Check if tweets exist for the match');
    console.log('2. Auto-collect them if < 5 tweets found');
    console.log('3. Generate the report with tweet context');
    console.log('');
    console.log('Starting...\n');

    const result = await generateReportPipeline({
      matchId,
      teamSlug,
      options: {
        saveInterpretation: false,
        autoCollectTweets: true,    // Enable auto-collection
        minTweetsRequired: 5         // Require at least 5 tweets
      }
    });

    console.log('\n' + '='.repeat(80));
    console.log('✅ PIPELINE COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Report generated successfully!');
    console.log('Headline:', result.report.headline);
    console.log('');
    console.log('Embedded Tweets:', result.report.embedded_tweets?.length || 0);
    
    if (result.report.embedded_tweets && result.report.embedded_tweets.length > 0) {
      console.log('\nTweet samples:');
      result.report.embedded_tweets.slice(0, 2).forEach((tweet, i) => {
        console.log(`\n[${i + 1}] @${tweet.author.userName}`);
        console.log(`    "${tweet.text.substring(0, 80)}..."`);
      });
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

testAutoCollection();
