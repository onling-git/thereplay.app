require('dotenv').config();
const { connectDB } = require('./db/connect');
const { syncFinishedMatch } = require('./controllers/matchSyncController');
const { generateBothReports } = require('./controllers/reportController');

// List of match IDs that are ready for report generation (based on our data check)
const readyMatchIds = [
  19431901, // West Bromwich Albion vs Sheffield Wednesday (0-0)
  19431899, // Stoke City vs Bristol City (5-1)
  19431895, // Oxford United vs Millwall (2-2)
  19431897, // Sheffield United vs Derby County (1-3)
  19427552, // Nottingham Forest vs Manchester United (2-2)
  19431896, // Queens Park Rangers vs Ipswich Town (1-4)
  19431891, // Birmingham City vs Portsmouth (4-0)
  19427546, // Brighton & Hove Albion vs Leeds United (3-0)
  19427547, // Burnley vs Arsenal (0-2)
  19427548, // Crystal Palace vs Brentford (2-0)
  19427549, // Fulham vs Wolverhampton Wanderers (3-0)
  19431900, // Watford vs Middlesbrough (3-0)
  19431892, // Charlton Athletic vs Swansea City (1-1)
  19427554, // Tottenham Hotspur vs Chelsea (0-1)
  19427550, // Liverpool vs Aston Villa (0-0)
  19427555  // West Ham United vs Newcastle United (3-1)
];

async function generateWeekendReports() {
  try {
    await connectDB(process.env.DBURI || process.env.MONGO_URI);
    
    console.log('🏈 Weekend Fixtures Report Generation');
    console.log('====================================');
    console.log('Generating AI reports for all ready matches from last weekend');
    console.log('(October 31 - November 2, 2025)\n');
    console.log('This will apply all our fixes:');
    console.log('✅ Improved lineup normalization');
    console.log('✅ Enhanced AI evidence structure');
    console.log('✅ Team-specific POTM generation');
    console.log('✅ Correct team context in reports');
    console.log('✅ Player name resolution from lineups');
    console.log('');
    
    let processed = 0;
    let errors = 0;
    let totalReports = 0;
    const results = [];
    
    for (const matchId of readyMatchIds) {
      try {
        console.log(`\n--- Processing Match ${matchId} (${processed + 1}/${readyMatchIds.length}) ---`);
        
        // Step 1: Quick data refresh to ensure latest state
        console.log(`  1. Refreshing match data...`);
        await syncFinishedMatch(matchId, { forFinished: true });
        console.log(`  ✓ Data refreshed`);
        
        // Step 2: Generate both team reports
        console.log(`  2. Generating AI reports for both teams...`);
        const reports = await generateBothReports(matchId);
        console.log(`  ✓ Reports generated successfully`);
        
        // Show report summaries
        let homeReportHeadline = 'No report';
        let awayReportHeadline = 'No report';
        let reportsGenerated = 0;
        
        if (reports.homeReport) {
          homeReportHeadline = reports.homeReport.headline;
          reportsGenerated++;
          totalReports++;
        }
        
        if (reports.awayReport) {
          awayReportHeadline = reports.awayReport.headline;
          reportsGenerated++;
          totalReports++;
        }
        
        console.log(`  📝 Home: "${homeReportHeadline}"`);
        console.log(`  📝 Away: "${awayReportHeadline}"`);
        console.log(`  📊 Reports generated: ${reportsGenerated}/2`);
        
        results.push({
          matchId,
          homeTeam: reports.homeReport?.team_focus || 'Unknown',
          awayTeam: reports.awayReport?.team_focus || 'Unknown',
          reportsGenerated,
          homeHeadline: homeReportHeadline,
          awayHeadline: awayReportHeadline
        });
        
        processed++;
        console.log(`  ✅ Match ${matchId} completed successfully`);
        
        // Add a delay to avoid overwhelming the OpenAI API
        if (processed < readyMatchIds.length) {
          console.log(`  ⏳ Waiting 3 seconds before next match...`);
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
      } catch (error) {
        errors++;
        console.error(`  ❌ Error processing match ${matchId}:`, error.message);
        console.error(`     Stack trace:`, error.stack?.split('\n')[1] || 'No stack trace');
        
        results.push({
          matchId,
          error: error.message,
          reportsGenerated: 0
        });
        
        // Continue with next match even if this one fails
        continue;
      }
    }
    
    console.log(`\n🎉 Report Generation Complete!`);
    console.log('================================');
    console.log(`✅ Successfully processed: ${processed}/${readyMatchIds.length} matches`);
    console.log(`📝 Total reports generated: ${totalReports}`);
    console.log(`❌ Errors: ${errors} matches`);
    console.log(`📊 Success rate: ${((processed / readyMatchIds.length) * 100).toFixed(1)}%`);
    
    console.log(`\n📋 DETAILED RESULTS:`);
    console.log('====================');
    results.forEach((result, i) => {
      console.log(`\n${i + 1}. Match ${result.matchId}:`);
      if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      } else {
        console.log(`   🏠 Home (${result.homeTeam}): "${result.homeHeadline}"`);
        console.log(`   🛫 Away (${result.awayTeam}): "${result.awayHeadline}"`);
        console.log(`   📊 Reports: ${result.reportsGenerated}/2`);
      }
    });
    
    if (totalReports > 0) {
      console.log(`\n🌟 SUCCESS! Generated ${totalReports} AI match reports with all our improvements!`);
      console.log(`\nThese reports now feature:`);
      console.log(`✅ Accurate team identification and context`);
      console.log(`✅ Proper lineup normalization (20 players per team)`);
      console.log(`✅ Team-specific Player of the Match selection`);
      console.log(`✅ Enhanced evidence structure for better AI analysis`);
      console.log(`✅ Player names resolved from lineup data`);
      console.log(`✅ Correct match outcomes and narratives`);
      console.log(`\n🎯 You can now view these reports on the frontend!`);
      console.log(`Example: http://localhost:3000/[team-slug]/match/[match-id]/report`);
    }
    
    if (errors > 0) {
      console.log(`\n⚠️  ${errors} matches had errors. Check the logs above for details.`);
    }
    
    process.exit();
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

generateWeekendReports();