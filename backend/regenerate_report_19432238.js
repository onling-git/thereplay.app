// Regenerate and save report for match 19432238
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Report = require('./models/Report');
const { generateReportPipeline } = require('./services/reportPipeline');

async function regenerateReport() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    const matchId = 19432238;
    
    // Get match details
    const match = await Match.findOne({ match_id: matchId });
    if (!match) {
      console.log(`❌ Match ${matchId} not found`);
      return;
    }

    console.log('\n📊 Match:', match.teams?.home?.team_name, 'vs', match.teams?.away?.team_name);
    console.log('Score:', match.score?.home, '-', match.score?.away);
    console.log('');

    // Determine team slug
    const homeSlug = match.teams?.home?.team_name?.toLowerCase().replace(/ /g, '-') || 'wrexham';
    
    console.log('🔄 Generating report for', homeSlug, '...');
    console.log('');

    // Generate report using pipeline
    const result = await generateReportPipeline({
      matchId: matchId,
      teamSlug: homeSlug,
      options: {
        saveInterpretation: true
      }
    });

    console.log('='.repeat(80));
    console.log('STEP 1: INTERPRETATION');
    console.log('='.repeat(80));
    console.log(JSON.stringify(result.interpretation, null, 2));
    console.log('');

    console.log('='.repeat(80));
    console.log('STEP 2: FINAL REPORT');
    console.log('='.repeat(80));
    console.log('');
    console.log('HEADLINE:', result.report.headline);
    console.log('');
    console.log('SUMMARY PARAGRAPHS:');
    result.report.summary_paragraphs.forEach((para, i) => {
      console.log(`\n[${i + 1}]`, para);
    });
    console.log('');
    console.log('KEY MOMENTS:');
    result.report.key_moments.forEach((moment, i) => {
      console.log(`${i + 1}.`, moment);
    });
    console.log('');
    if (result.report.player_of_the_match) {
      console.log('PLAYER OF THE MATCH:', result.report.player_of_the_match.player);
      console.log('Reason:', result.report.player_of_the_match.reason);
    }
    console.log('');

    // Save to database (override existing)
    console.log('='.repeat(80));
    console.log('SAVING TO DATABASE');
    console.log('='.repeat(80));
    
    // Delete existing reports for this match and team
    const deleteResult = await Report.deleteMany({
      match_id: matchId,
      team_slug: homeSlug
    });
    
    if (deleteResult.deletedCount > 0) {
      console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing report(s)`);
    }

    // Create new report with data in 'generated' object as frontend expects
    const newReport = new Report({
      match_id: matchId,
      team_id: match.teams?.home?.team_id || match.home_team,
      team_slug: homeSlug,
      headline: result.report.headline,
      status: 'final', // Set as final so it appears on the site
      generated_at: new Date(),
      updated_at: new Date(),
      // Data must be in 'generated' object for frontend display
      generated: {
        headline: result.report.headline,
        summary_paragraphs: result.report.summary_paragraphs,
        key_moments: result.report.key_moments,
        commentary: result.report.commentary || [],
        player_of_the_match: result.report.player_of_the_match,
        sources: result.report.sources || [],
        embedded_tweets: result.report.embedded_tweets || []
      },
      meta: result.report.meta
    });

    await newReport.save();
    
    console.log('✅ Report saved successfully!');
    console.log('Report ID:', newReport._id);
    console.log('');

    // Update match document to reference the new report
    console.log('🔄 Updating match document to reference this report...');
    
    const isHome = homeSlug === (match.teams?.home?.team_name?.toLowerCase().replace(/ /g, '-'));
    const reportField = isHome ? 'reports.home' : 'reports.away';
    
    await Match.updateOne(
      { match_id: matchId },
      { 
        $set: { 
          [reportField]: newReport._id,
          'reports.generated_at': new Date()
        } 
      }
    );
    
    console.log(`✅ Match document updated (${reportField} = ${newReport._id})`);
    console.log('');

    console.log('='.repeat(80));
    console.log('PERFORMANCE');
    console.log('='.repeat(80));
    console.log('Step 1 Time:', result.report.meta?.pipeline?.interpretation_time_ms, 'ms');
    console.log('Step 2 Time:', result.report.meta?.pipeline?.writing_time_ms, 'ms');
    console.log('Total Time:', result.report.meta?.pipeline?.total_time_ms, 'ms');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

regenerateReport();
