require('dotenv').config();
const mongoose = require('mongoose');
const Report = require('./models/Report');

async function checkReportEmbeddedTweets() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    // Find the Southampton report
    const report = await Report.findOne({ 
      match_id: 19432238,
      team_id: 65 // Southampton
    }).sort({ created_at: -1 }); // Most recent

    if (!report) {
      console.log('❌ Report not found');
      return;
    }

    console.log('=== REPORT STRUCTURE ===');
    console.log('Report ID:', report._id);
    console.log('Top-level keys:', Object.keys(report.toObject()));
    
    console.log('\n=== DATA OBJECT ===');
    if (report.data) {
      console.log('data keys:', Object.keys(report.data));
    }

    console.log('\n=== GENERATED OBJECT ===');
    if (report.data?.generated) {
      console.log('generated keys:', Object.keys(report.data.generated));
      console.log('embedded_tweets present?', 'embedded_tweets' in report.data.generated);
      console.log('embedded_tweets count:', report.data.generated.embedded_tweets?.length || 0);
    }

    console.log('\n=== EMBEDDED TWEETS ===');
    if (report.data?.generated?.embedded_tweets) {
      report.data.generated.embedded_tweets.forEach((tweet, i) => {
        console.log(`\nTweet ${i + 1}:`);
        console.log('  tweet_id:', tweet.tweet_id);
        console.log('  author:', tweet.author?.userName);
        console.log('  text:', tweet.text?.substring(0, 60) + '...');
        console.log('  embed_context:', tweet.embed_context);
      });
    } else {
      console.log('❌ No embedded_tweets found in report.data.generated');
    }

    console.log('\n=== TESTING FRONTEND ACCESS PATH ===');
    console.log('report.data?.generated?.embedded_tweets:', report.data?.generated?.embedded_tweets ? 'EXISTS' : 'MISSING');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkReportEmbeddedTweets();
