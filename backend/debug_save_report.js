// Debug saveReportToDatabase for match 19432248
const mongoose = require('mongoose');
require('dotenv').config();

const Match = require('./models/Match');
const Report = require('./models/Report');
const { generateReportPipeline } = require('./services/reportPipeline');

async function debugSave() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to MongoDB');
    
    const matchId = 19432248;
    const homeSlug = '__home_19432248';
    
    // Generate report
    console.log('\n🏠 Generating HOME report...');
    const homeResult = await generateReportPipeline({
      matchId,
      teamSlug: homeSlug,
      options: { autoCollectTweets: true, minTweetsRequired: 5 }
    });
    
    console.log('\n=== GENERATED REPORT OBJECT ===');
    console.log(`Embedded tweets in report: ${homeResult.report.embedded_tweets?.length || 0}`);
    console.log(`Team slug in report: ${homeResult.report.team_slug}`);
    console.log(`Team name in report: ${homeResult.report.team_name}`);
    
    if (homeResult.report.embedded_tweets && homeResult.report.embedded_tweets.length > 0) {
      console.log('\nEmbedded tweets:');
      homeResult.report.embedded_tweets.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.tweet_id} - @${t.author.userName}`);
      });
    }
    
    // Check for existing reports with different slugs
    console.log('\n=== CHECKING EXISTING REPORTS ===');
    const allReports = await Report.find({ match_id: matchId }).lean();
    console.log(`Found ${allReports.length} existing reports for match ${matchId}`);
    allReports.forEach(r => {
      console.log(`  - team_slug: "${r.team_slug}", embedded_tweets: ${r.embedded_tweets?.length || 0}`);
    });
    
    // Check what the query will find
    const querySlug = homeResult.report.team_slug;
    console.log(`\nQuerying for: match_id=${matchId}, team_slug="${querySlug}"`);
    const existingReport = await Report.findOne({
      match_id: matchId,
      team_slug: querySlug
    });
    
    console.log(`Found existing: ${existingReport ? 'YES' : 'NO'}`);
    if (existingReport) {
      console.log(`  Existing embedded_tweets: ${existingReport.embedded_tweets?.length || 0}`);
    }
    
    // Now actually test saving
    console.log('\n=== TESTING SAVE ===');
    const { saveReportToDatabase } = require('./controllers/reportControllerV2');
    
    const savedReport = await saveReportToDatabase({
      report: homeResult.report,
      matchId,
      teamSlug: homeSlug,
      metadata: homeResult.metadata
    });
    
    console.log(`\nSaved report embedded_tweets: ${savedReport.embedded_tweets?.length || 0}`);
    if (savedReport.embedded_tweets && savedReport.embedded_tweets.length > 0) {
      console.log('✅ SUCCESS! Embedded tweets were saved!');
      savedReport.embedded_tweets.forEach((t, i) => {
        console.log(`  ${i + 1}. ${t.tweet_id}`);
      });
    } else {
      console.log('❌ FAILED! Embedded tweets were NOT saved!');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

debugSave();
