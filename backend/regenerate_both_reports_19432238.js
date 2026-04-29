// Regenerate BOTH Wrexham and Southampton reports for match 19432238
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Report = require('./models/Report');
const { generateReportPipeline } = require('./services/reportPipeline');

async function regenerateBothReports() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const matchId = 19432238;
    const teams = [
      { slug: 'wrexham', field: 'home' },
      { slug: 'southampton', field: 'away' }
    ];

    const match = await Match.findOne({ match_id: matchId });
    if (!match) {
      console.error('❌ Match not found');
      process.exit(1);
    }

    console.log(`📋 Match: ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
    console.log(`Score: ${match.score?.ft_score}\n`);

    for (const team of teams) {
      console.log('\n' + '='.repeat(80));
      console.log(`🏆 GENERATING REPORT FOR: ${team.slug.toUpperCase()}`);
      console.log('='.repeat(80));

      // Generate report using the pipeline
      const result = await generateReportPipeline({
        matchId,
        teamSlug: team.slug,
        options: {
          saveInterpretation: true
        }
      });

      console.log('\n--- STEP 1: INTERPRETATION ---');
      console.log(JSON.stringify(result.interpretation, null, 2));

      console.log('\n--- STEP 2: FINAL REPORT ---');
      console.log('HEADLINE:', result.report.headline);
      console.log('\nSUMMARY PARAGRAPHS:');
      result.report.summary_paragraphs.forEach((para, i) => {
        console.log(`\n[${i + 1}]`, para);
      });
      console.log('\nKEY MOMENTS:');
      result.report.key_moments.forEach((moment, i) => {
        console.log(`${i + 1}.`, moment);
      });
      console.log('\nPLAYER OF THE MATCH:', result.report.player_of_the_match.player);
      console.log('Reason:', result.report.player_of_the_match.reason);

      // Save to database
      console.log('\n🗄️  Saving to database...');
      
      // Delete existing reports for this match and team
      const deleteResult = await Report.deleteMany({
        match_id: matchId,
        team_slug: team.slug
      });
      
      if (deleteResult.deletedCount > 0) {
        console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing report(s)`);
      }

      // Get correct team_id
      const teamId = team.field === 'home' 
        ? match.teams?.home?.team_id 
        : match.teams?.away?.team_id;

      // Create new report with data in 'generated' object as frontend expects
      const newReport = new Report({
        match_id: matchId,
        team_id: teamId,
        team_slug: team.slug,
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

      // Update match document to reference the new report
      console.log('🔄 Updating match document...');
      
      const reportField = `reports.${team.field}`;
      
      await Match.updateOne(
        { match_id: matchId },
        { 
          $set: { 
            [reportField]: newReport._id,
            'reports.generated_at': new Date()
          } 
        }
      );
      
      console.log(`✅ Match document updated with new ${team.field} report reference`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('🎉 BOTH REPORTS REGENERATED SUCCESSFULLY!');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

regenerateBothReports();
