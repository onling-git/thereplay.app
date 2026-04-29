// scripts/testReportPipeline.js
// Test script for the new 2-step report generation pipeline

require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { generateReportPipeline } = require('../services/reportPipeline');
const Report = require('../models/Report');
const Match = require('../models/Match');

// Configuration
const MATCH_ID = parseInt(process.argv[2]) || 19631550; // Default to a match ID
const TEAM_SLUG = process.argv[3] || 'southampton'; // Default to Southampton
const SAVE_TO_DB = process.argv.includes('--save'); // Add --save flag to save to database

async function testPipeline() {
  try {
    console.log('='.repeat(60));
    console.log('TESTING 2-STEP MATCH REPORT PIPELINE');
    console.log('='.repeat(60));
    console.log(`Match ID: ${MATCH_ID}`);
    console.log(`Team: ${TEAM_SLUG}`);
    console.log('');

    // Connect to database
    console.log('[1/4] Connecting to database...');
    await mongoose.connect(process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay', {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected');
    console.log('');

    // Run the pipeline
    console.log('[2/4] Running 2-step pipeline...');
    const startTime = Date.now();
    
    const result = await generateReportPipeline({
      matchId: MATCH_ID,
      teamSlug: TEAM_SLUG,
      options: {
        saveInterpretation: true // Get debug output
      }
    });
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Pipeline complete in ${totalTime}ms`);
    console.log('');

    // Display Step 1 Output
    console.log('[3/4] STEP 1: Match Interpretation');
    console.log('-'.repeat(60));
    console.log('Overall Story:', result.interpretation.overall_story);
    console.log('');
    console.log('First Half:', result.interpretation.first_half.summary);
    console.log('Second Half:', result.interpretation.second_half.summary);
    console.log('');
    console.log('Decisive Moment:', result.interpretation.decisive_moment.description);
    console.log(`  (Minute ${result.interpretation.decisive_moment.minute})`);
    console.log('');
    console.log('Selected Tweets:', result.interpretation.selected_tweets.length);
    result.interpretation.selected_tweets.forEach((tweet, i) => {
      console.log(`  ${i + 1}. "${tweet.text.substring(0, 60)}..." - ${tweet.author}`);
    });
    console.log('');

    // Display Step 2 Output
    console.log('[4/4] STEP 2: Final Report');
    console.log('-'.repeat(60));
    console.log('Headline:', result.report.headline);
    console.log('');
    console.log('Summary Paragraphs:', result.report.summary_paragraphs.length);
    result.report.summary_paragraphs.forEach((para, i) => {
      console.log(`  ${i + 1}. ${para.substring(0, 100)}...`);
    });
    console.log('');
    console.log('Key Moments:', result.report.key_moments.length);
    result.report.key_moments.slice(0, 5).forEach(moment => {
      console.log(`  - ${moment}`);
    });
    console.log('');
    console.log('Player of the Match:', result.report.player_of_the_match.player);
    console.log('  Reason:', result.report.player_of_the_match.reason);
    console.log('');
    console.log('Embedded Tweets:', result.report.embedded_tweets.length);
    console.log('');

    // Performance Metrics
    console.log('='.repeat(60));
    console.log('PERFORMANCE METRICS');
    console.log('='.repeat(60));
    console.log('Step 1 (Interpretation):', `${result.report.meta.pipeline.interpretation_time_ms}ms`);
    console.log('Step 2 (Writing):       ', `${result.report.meta.pipeline.writing_time_ms}ms`);
    console.log('Total:                  ', `${result.report.meta.pipeline.total_time_ms}ms`);
    console.log('');
    console.log('Models Used:');
    console.log('  Interpretation:', result.interpretation.model);
    console.log('  Report:        ', result.report.meta.generated_by);
    console.log('');

    // Full Report JSON
    console.log('='.repeat(60));
    console.log('FULL REPORT JSON (for verification)');
    console.log('='.repeat(60));
    console.log('FULL REPORT JSON (for verification)');
    console.log('='.repeat(60));
    console.log(JSON.stringify(result.report, null, 2));
    console.log('');

    // Save report to JSON file
    const reportsDir = path.join(__dirname, '../test-reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    
    const filename = `report_${MATCH_ID}_${TEAM_SLUG}_${Date.now()}.json`;
    const filepath = path.join(reportsDir, filename);
    fs.writeFileSync(filepath, JSON.stringify({
      report: result.report,
      interpretation: result.interpretation,
      metadata: result.metadata
    }, null, 2));
    
    console.log('💾 Report saved to file:', filepath);
    console.log('');

    // Optionally save to database
    if (SAVE_TO_DB) {
      console.log('💾 Saving to database...');
      try {
        const savedReport = await saveReportToDatabase({
          report: result.report,
          matchId: MATCH_ID,
          teamSlug: TEAM_SLUG,
          metadata: result.metadata
        });
        console.log('✅ Saved to database with ID:', savedReport._id);
      } catch (saveError) {
        console.error('❌ Failed to save to database:', saveError.message);
      }
    } else {
      console.log('ℹ️  Report NOT saved to database (use --save flag to save)');
    }
    console.log('');

    console.log('✅ Test complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

/**
 * Save report to database (simplified version from controller)
 */
async function saveReportToDatabase({ report, matchId, teamSlug, metadata }) {
  const match = await Match.findOne({ match_id: Number(matchId) }).lean();
  if (!match) throw new Error('Match not found for save');
  
  // Check for existing report
  let existingReport = await Report.findOne({
    match_id: match.match_id,
    team_slug: report.team_slug
  });
  
  if (existingReport) {
    // Update existing
    Object.assign(existingReport, {
      headline: report.headline,
      summary_paragraphs: report.summary_paragraphs,
      key_moments: report.key_moments,
      commentary: report.commentary,
      player_of_the_match: report.player_of_the_match,
      sources: report.sources,
      embedded_tweets: report.embedded_tweets,
      meta: report.meta,
      updated_at: new Date()
    });
    await existingReport.save();
    return existingReport.toObject();
  }
  
  // Create new
  const newReport = new Report({
    match_id: match.match_id,
    team_slug: report.team_slug,
    headline: report.headline,
    summary_paragraphs: report.summary_paragraphs,
    key_moments: report.key_moments,
    commentary: report.commentary,
    player_of_the_match: report.player_of_the_match,
    sources: report.sources,
    embedded_tweets: report.embedded_tweets,
    meta: report.meta,
    created_at: new Date(),
    updated_at: new Date()
  });
  
  await newReport.save();
  return newReport.toObject();
}

// Run the test
testPipeline();

// ===== USAGE =====
// 
// Test with default match:
//   node scripts/testReportPipeline.js
//
// Test specific match and team:
//   node scripts/testReportPipeline.js 19631550 southampton
//
// Make sure your .env has:
//   MONGODB_URI=mongodb://localhost:27017/thefinalplay
//   OPENAI_API_KEY=sk-...
//   INTERPRETATION_MODEL=gpt-4o-mini
//   REPORT_MODEL=gpt-4o-mini
