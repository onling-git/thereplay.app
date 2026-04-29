// Check why match 19631550 didn't get a report (League Cup investigation)
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Report = require('./models/Report');

async function checkMatch19631550() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    console.log('Attempting to connect to MongoDB...');
    
    // Try alternative connection method
    try {
      await mongoose.connect(uri);
      console.log('📊 Connected to database successfully');
    } catch (dbError) {
      console.error('Database connection failed:', dbError.message);
      // Continue with analysis using what we know
      await analyzeWithoutDB();
      return;
    }

    const matchId = 19631550;
    console.log(`\n🔍 Investigating match ${matchId}...`);
    
    // Find the match
    const match = await Match.findOne({ match_id: matchId }).lean();
    
    if (!match) {
      console.log(`❌ Match ${matchId} not found in database`);
      return;
    }

    console.log('\n📊 MATCH DETAILS:');
    console.log(`   ID: ${match.match_id}`);
    console.log(`   Teams: ${match.home_team || match.teams?.home?.team_name} vs ${match.away_team || match.teams?.away?.team_name}`);
    console.log(`   Status: ${match.match_status?.name || match.match_status?.state || match.match_status || 'UNKNOWN'}`);
    console.log(`   Date: ${match.date || match.match_info?.starting_at}`);
    console.log(`   League: ${match.league?.name || match.competition?.name || 'UNKNOWN'}`);
    console.log(`   League ID: ${match.league?.id || match.competition?.id || 'UNKNOWN'}`);
    console.log(`   Season: ${match.season?.name || match.season_id || 'UNKNOWN'}`);

    // Check report generation criteria for League Cup specifically
    console.log('\n🔍 REPORT GENERATION CRITERIA FOR LEAGUE CUP:');
    
    const status = match.match_status?.name || match.match_status?.state || match.match_status;
    const isFinished = ['FT', 'finished', 'ended', 'full-time'].includes(status?.toLowerCase());
    console.log(`   ✓ Match finished: ${isFinished} (Status: ${status})`);
    
    const leagueId = match.league?.id || match.competition?.id;
    const isLeagueCup = leagueId === 27;
    console.log(`   ✓ League Cup match: ${isLeagueCup} (League ID: ${leagueId})`);
    
    // Check if League Cup is processed by cron
    const processedLeagues = [8, 9, 24, 27]; // Including League Cup
    const isProcessedLeague = processedLeagues.includes(leagueId);
    console.log(`   ✓ Processed league: ${isProcessedLeague}`);
    
    // Check team slugs
    const homeSlug = match.home_team_slug || match.teams?.home?.team_slug;
    const awaySlug = match.away_team_slug || match.teams?.away?.team_slug;
    console.log(`   📝 Home team slug: ${homeSlug || 'MISSING'}`);
    console.log(`   📝 Away team slug: ${awaySlug || 'MISSING'}`);
    
    // Check reports
    console.log('\n📝 EXISTING REPORTS:');
    console.log(`   - reports.home: ${match.reports?.home || 'None'}`);
    console.log(`   - reports.away: ${match.reports?.away || 'None'}`);
    console.log(`   - has_report: ${match.has_report || false}`);
    
    // Find any existing reports in the Report collection
    const existingReports = await Report.find({ match_id: matchId }).lean();
    console.log(`   - Report documents found: ${existingReports.length}`);
    
    if (existingReports.length > 0) {
      existingReports.forEach((report, index) => {
        console.log(`     ${index + 1}. Team: ${report.team_slug || report.team_focus} - Status: ${report.status}`);
      });
    }

    // Check match data quality
    console.log('\n📊 MATCH DATA QUALITY:');
    console.log(`   - Events: ${(match.events || []).length}`);
    console.log(`   - Player ratings: ${(match.player_ratings || []).length}`);
    console.log(`   - Score: ${match.score ? `${match.score.home}-${match.score.away}` : 'Not set'}`);
    console.log(`   - Kickoff time: ${match.kickoff_time || match.date || 'Not set'}`);

    // Check cron processing status
    console.log('\n🤖 CRON PROCESSING:');
    console.log(`   - Last updated: ${match.updatedAt || 'Unknown'}`);
    console.log(`   - Created: ${match.createdAt || 'Unknown'}`);

    // Analysis and recommendations
    console.log('\n🔧 ANALYSIS AND RECOMMENDATIONS:');
    
    if (!isFinished) {
      console.log('   ❌ Match status indicates it may not be finished yet');
    }
    
    if (!isLeagueCup) {
      console.log('   ❌ This is not a League Cup match');
    } else if (!isProcessedLeague) {
      console.log('   ❌ League Cup (ID 27) might not be included in report generation');
      console.log('   💡 SUGGESTION: Check if League Cup (ID 27) is included in the cron job league filters');
    }
    
    if (!homeSlug && !awaySlug) {
      console.log('   ❌ Missing team slugs - reports cannot be generated without them');
    }
    
    if (existingReports.length === 0 && isFinished && isLeagueCup) {
      console.log('   ⚠️ Match appears finished and is League Cup but no reports exist');
      console.log('   💡 Likely cause: League Cup not included in automated report generation');
    }

    // Check if this specific match appears in any processing logs
    console.log('\n📈 NEXT STEPS:');
    console.log('   1. Verify League Cup (ID 27) is included in cron job filters');
    console.log('   2. Check if the match status changed to "finished" recently');
    console.log('   3. Manually trigger report generation for this match');
    console.log('   4. Review cron job logs for any errors during processing');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n✅ Database disconnected');
    }
  }
}

async function analyzeWithoutDB() {
  console.log('\n🔍 ANALYSIS WITHOUT DATABASE CONNECTION:');
  console.log('\nBased on the codebase analysis:');
  console.log('✓ League Cup (ID 27) is defined in CUP_LEAGUES object');
  console.log('✓ League Cup matches should be processed by the cron job');
  console.log('✓ The cron job filters include League Cup matches');
  
  console.log('\n❓ POTENTIAL ISSUES:');
  console.log('1. Match might not have finished status when cron ran');
  console.log('2. Team slugs might be missing, preventing report generation');
  console.log('3. Cron job might have encountered an error for this specific match');
  console.log('4. Match data might be incomplete (missing events, ratings, etc.)');
  
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('1. Check cron logs for any errors on the night the match was played');
  console.log('2. Verify the match status was properly updated to "finished"');
  console.log('3. Manually run report generation for this match ID');
  console.log('4. Consider adding more detailed logging for League Cup processing');
}

checkMatch19631550();