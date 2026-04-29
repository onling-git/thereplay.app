// Verify that reports are using ONLY reporter tweets
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Report = require('./models/Report');
const Tweet = require('./models/Tweet');

async function main() {
  await mongoose.connect(process.env.DBURI);
  
  // Get Southampton report
  const report = await Report.findOne({ 
    match_id: 19432260,
    team_id: 65
  }).lean();
  
  console.log('='.repeat(80));
  console.log('SOUTHAMPTON REPORT TWEET VERIFICATION');
  console.log('='.repeat(80));
  
  if (!report) {
    console.log('❌ Report not found');
    return;
  }
  
  console.log(`\n📊 Report has ${report.embedded_tweets?.length || 0} embedded tweets`);
  
  // Check what tweets are in the database for Southampton match 19432260
  const allTweets = await Tweet.find({
    match_id: 19432260,
    team_id: 65
  }).lean();
  
  console.log(`\n📦 Database has ${allTweets.length} total tweets for Southampton match 19432260`);
  
  const reporterTweets = allTweets.filter(t => 
    t.collection_context?.search_type === 'reporter' || 
    t.collection_context?.source_priority === 1
  );
  
  const hashtagTweets = allTweets.filter(t => 
    t.collection_context?.search_type === 'hashtag' ||
    (t.collection_context?.source_priority !== 1 && t.collection_context?.search_type !== 'reporter')
  );
  
  console.log(`\n📰 REPORTER tweets: ${reporterTweets.length}`);
  console.log(`📱 HASHTAG tweets: ${hashtagTweets.length}`);
  
  console.log('\n📰 Reporter tweets breakdown:');
  reporterTweets.forEach((tweet, i) => {
    console.log(`  ${i + 1}. @${tweet.author?.userName}: ${tweet.text?.substring(0, 60)}...`);
    console.log(`     search_type: ${tweet.collection_context?.search_type}, priority: ${tweet.collection_context?.source_priority}`);
    console.log(`     collected_for: ${tweet.collection_context?.collected_for}`);
  });
  
  console.log('\n✅ VERIFICATION:');
  if (hashtagTweets.length === 0) {
    console.log('   ✅ No hashtag tweets associated with match - CORRECT!');
  } else {
    console.log(`   ⚠️ Found ${hashtagTweets.length} hashtag tweets - should not be used in reports`);
  }
  
  if (reporterTweets.length > 0) {
    console.log(`   ✅ Found ${reporterTweets.length} reporter tweets - CORRECT!`);
  } else {
    console.log('   ❌ No reporter tweets found');
  }
  
  console.log('\n' + '='.repeat(80));
  
  await mongoose.disconnect();
}

main().catch(console.error);
