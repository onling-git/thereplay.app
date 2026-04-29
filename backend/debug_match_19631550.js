// Debug script to check why match 19631550 didn't get a report
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Report = require('./models/Report');

async function checkMatch19631550() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    console.log('📊 Connected to database');

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

    // Check report generation criteria
    console.log('\n🔍 REPORT GENERATION CRITERIA CHECK:');
    
    // 1. Match Status Check
    const status = match.match_status?.name || match.match_status?.state || match.match_status;
    const isFinished = ['FT', 'finished', 'ended', 'full-time'].includes(status?.toLowerCase());
    console.log(`   ✅ Match finished: ${isFinished} (Status: ${status})`);
    
    // 2. League Check
    const leagueId = match.league?.id || match.competition?.id;
    const isLeagueCup = leagueId === 27;
    console.log(`   ✅ League Cup match: ${isLeagueCup} (League ID: ${leagueId})`);
    
    // 3. Team Slugs Check
    const homeSlug = match.home_team_slug || match.teams?.home?.team_slug;
    const awaySlug = match.away_team_slug || match.teams?.away?.team_slug;
    console.log(`   📝 Home team slug: ${homeSlug || 'MISSING'}`);
    console.log(`   📝 Away team slug: ${awaySlug || 'MISSING'}`);
    
    // 4. Reports Check
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

    // 5. Match Events and Data Check
    console.log('\n📊 MATCH DATA QUALITY:');
    console.log(`   - Events: ${(match.events || []).length}`);
    console.log(`   - Player ratings: ${(match.player_ratings || []).length}`);
    console.log(`   - Score: ${match.score ? `${match.score.home}-${match.score.away}` : 'Not set'}`);
    console.log(`   - Kickoff time: ${match.kickoff_time || match.date || 'Not set'}`);

    // 6. Check if match was processed by cron
    console.log('\n🤖 CRON PROCESSING:');
    console.log(`   - Last updated: ${match.updatedAt || 'Unknown'}`);
    console.log(`   - Created: ${match.createdAt || 'Unknown'}`);

    // Generate a synthetic team slug if missing
    if (!homeSlug && match.teams?.home?.team_name) {
      const syntheticSlug = match.teams.home.team_name.toLowerCase().replace(/\s+/g, '-');
      console.log(`\n💡 SUGGESTED FIX:`);
      console.log(`   Home team slug missing. Could use: "${syntheticSlug}"`);
    }

    // Check for any errors in the cron logs (if available)
    console.log('\n🔧 TROUBLESHOOTING SUGGESTIONS:');
    
    if (!isFinished) {
      console.log('   ❌ Match status indicates it may not be finished yet');
    }
    
    if (!homeSlug && !awaySlug) {
      console.log('   ❌ Missing team slugs - reports cannot be generated without them');
    }
    
    if (existingReports.length === 0 && isFinished) {
      console.log('   ⚠️ Match appears finished but no reports exist - possible cron failure');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
  }
}

checkMatch19631550();