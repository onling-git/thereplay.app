require('dotenv').config();
const { connectDB } = require('./db/connect');
const { syncFinishedMatch } = require('./controllers/matchSyncController');
const { generateBothReports } = require('./controllers/reportController');

// List of match IDs that need report generation
const matchIds = [
  19431902, // Wrexham vs Coventry City (0-0)
  19431901, // West Bromwich Albion vs Sheffield Wednesday (0-0)
  19431899, // Stoke City vs Bristol City (5-1)
  19596414, // Peterborough United vs Cardiff City (1-0)
  19596397, // Blackpool vs Scunthorpe United (1-0)
  19431895, // Oxford United vs Millwall (2-2)
  19431897, // Sheffield United vs Derby County (1-3)
  19427552, // Nottingham Forest vs Manchester United (2-2)
  19596416, // Rotherham United vs Swindon Town (1-2)
  19596426, // Wycombe Wanderers vs Plymouth Argyle (2-0)
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

async function processWeekendMatches() {
  try {
    await connectDB(process.env.DBURI || process.env.MONGO_URI);
    
    console.log(`Processing ${matchIds.length} matches from last weekend...\n`);
    
    let processed = 0;
    let errors = 0;
    
    for (const matchId of matchIds) {
      try {
        console.log(`\n--- Processing Match ${matchId} (${processed + 1}/${matchIds.length}) ---`);
        
        // Step 1: Sync finished match data (ratings, stats, lineup normalization)
        console.log(`  1. Syncing match data and normalizing lineups...`);
        await syncFinishedMatch(matchId, { forFinished: true });
        console.log(`  ✓ Match data synced successfully`);
        
        // Step 2: Generate both team reports
        console.log(`  2. Generating AI reports for both teams...`);
        const reports = await generateBothReports(matchId);
        console.log(`  ✓ Reports generated successfully`);
        
        // Show report summaries
        if (reports.homeReport) {
          console.log(`  📝 Home report: ${reports.homeReport.team_focus} - "${reports.homeReport.headline}"`);
        }
        if (reports.awayReport) {
          console.log(`  📝 Away report: ${reports.awayReport.team_focus} - "${reports.awayReport.headline}"`);
        }
        
        processed++;
        console.log(`  ✅ Match ${matchId} completed successfully`);
        
        // Add a small delay to avoid overwhelming the API
        if (processed < matchIds.length) {
          console.log(`  ⏳ Waiting 2 seconds before next match...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        errors++;
        console.error(`  ❌ Error processing match ${matchId}:`, error.message);
        console.error(`     Full error:`, error);
        
        // Continue with next match even if this one fails
        continue;
      }
    }
    
    console.log(`\n🎉 Processing complete!`);
    console.log(`✅ Successfully processed: ${processed} matches`);
    console.log(`❌ Errors: ${errors} matches`);
    console.log(`📊 Success rate: ${((processed / matchIds.length) * 100).toFixed(1)}%`);
    
    if (errors > 0) {
      console.log(`\n⚠️  Some matches had errors. Check the logs above for details.`);
    }
    
    process.exit();
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

console.log('🏈 Weekend Fixtures Report Generation Script');
console.log('===========================================');
console.log('This script will process all English league matches from last weekend');
console.log('(October 31 - November 2, 2025) through the new report generation system.');
console.log('');
console.log('For each match, it will:');
console.log('1. Sync match data and normalize lineups');
console.log('2. Generate AI reports for both teams');
console.log('3. Apply all the fixes we implemented');
console.log('');

processWeekendMatches();