// Regenerate match 19432248 reports using v2 pipeline
const mongoose = require('mongoose');
require('dotenv').config();

const Match = require('./models/Match');
const Report = require('./models/Report');
const { generateReportPipeline } = require('./services/reportPipeline');
const { saveReportToDatabase } = require('./controllers/reportControllerV2');

async function regenerate() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to MongoDB');
    
    const matchId = 19432248;
    
    // Get match
    const match = await Match.findOne({ match_id: matchId }).lean();
    if (!match) {
      console.log(`❌ Match ${matchId} not found`);
      return;
    }
    
    console.log('\n=== MATCH DETAILS ===');
    console.log(`Match: ${match.home_team} vs ${match.away_team}`);
    console.log(`Home slug: ${match.home_team_slug}`);
    console.log(`Away slug: ${match.away_team_slug}`);
    
    const homeSlug = match.home_team_slug || `__home_${matchId}`;
    const awaySlug = match.away_team_slug || `__away_${matchId}`;
    
    // Delete old reports
    console.log('\n🗑️ Deleting old reports...');
    const deleteResult = await Report.deleteMany({ match_id: matchId });
    console.log(`Deleted ${deleteResult.deletedCount} old reports`);
    
    // Clear report references from match
    await Match.updateOne(
      { match_id: matchId },
      { $unset: { reports: "" } }
    );
    
    // Generate HOME report with v2 pipeline
    console.log(`\n🏠 Generating HOME report for ${homeSlug}...`);
    const homeResult = await generateReportPipeline({
      matchId,
      teamSlug: homeSlug,
      options: { 
        autoCollectTweets: true,
        minTweetsRequired: 5
      }
    });
    
    console.log('✅ Home report generated');
    console.log(`  - Interpretation model: ${homeResult.interpretation.model}`);
    console.log(`  - Selected tweets: ${homeResult.interpretation.selected_tweets?.length || 0}`);
    console.log(`  - Report headline: ${homeResult.report.headline}`);
    
    // Save home report
    const savedHome = await saveReportToDatabase({
      report: homeResult.report,
      matchId,
      teamSlug: homeSlug,
      metadata: homeResult.metadata
    });
    
    console.log(`  - Saved with ${savedHome.embedded_tweets?.length || 0} embedded tweets`);
    console.log(`  - Sources: ${savedHome.sources?.length || 0}`);
    
    // Generate AWAY report with v2 pipeline
    console.log(`\n✈️ Generating AWAY report for ${awaySlug}...`);
    const awayResult = await generateReportPipeline({
      matchId,
      teamSlug: awaySlug,
      options: { 
        autoCollectTweets: true,
        minTweetsRequired: 5
      }
    });
    
    console.log('✅ Away report generated');
    console.log(`  - Interpretation model: ${awayResult.interpretation.model}`);
    console.log(`  - Selected tweets: ${awayResult.interpretation.selected_tweets?.length || 0}`);
    console.log(`  - Report headline: ${awayResult.report.headline}`);
    
    // Save away report
    const savedAway = await saveReportToDatabase({
      report: awayResult.report,
      matchId,
      teamSlug: awaySlug,
      metadata: awayResult.metadata
    });
    
    console.log(`  - Saved with ${savedAway.embedded_tweets?.length || 0} embedded tweets`);
    console.log(`  - Sources: ${savedAway.sources?.length || 0}`);
    
    console.log('\n✅ REGENERATION COMPLETE');
    console.log(`\nHome report ID: ${savedHome._id}`);
    console.log(`Away report ID: ${savedAway._id}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

regenerate();
