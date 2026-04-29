// Fix specific match 19631550 - League Cup match that missed report generation
require('dotenv').config();
const mongoose = require('mongoose');
const { generateBothReports } = require('./controllers/reportController');
const ReportMonitoring = require('./utils/reportMonitoring');

async function fixMatch19631550() {
  try {
    console.log('🔧 Fixing Match 19631550 - League Cup Report Generation');
    console.log('======================================================\n');

    // Connect to database
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    
    try {
      await mongoose.connect(uri);
      console.log('📊 Connected to database');
    } catch (connectError) {
      console.error('❌ Database connection failed:', connectError.message);
      console.log('\n💡 This script requires database access to generate reports.');
      console.log('   Please ensure your IP is whitelisted in MongoDB Atlas.');
      process.exit(1);
    }

    const matchId = 19631550;

    // Step 1: Check current status
    console.log(`\n🔍 Step 1: Checking current status of match ${matchId}...`);
    
    const Match = require('./models/Match');
    const Report = require('./models/Report');
    
    const match = await Match.findOne({ match_id: matchId }).lean();
    
    if (!match) {
      console.error(`❌ Match ${matchId} not found in database`);
      process.exit(1);
    }

    console.log('✅ Match found:');
    console.log(`   Teams: ${match.teams?.home?.team_name || match.home_team} vs ${match.teams?.away?.team_name || match.away_team}`);
    console.log(`   Status: ${match.match_status?.name || match.match_status?.state || match.match_status}`);
    console.log(`   League: ${match.league?.name || match.competition?.name} (ID: ${match.league?.id || match.competition?.id})`);
    console.log(`   Date: ${match.date || match.match_info?.starting_at}`);

    // Check existing reports
    const existingReports = await Report.find({ match_id: matchId }).lean();
    console.log(`   Existing reports: ${existingReports.length}`);

    if (existingReports.length > 0) {
      console.log('   Report details:');
      existingReports.forEach((report, index) => {
        console.log(`     ${index + 1}. Team: ${report.team_slug || report.team_focus} - Status: ${report.status}`);
      });
    }

    // Step 2: Validate match is suitable for report generation
    console.log('\n📋 Step 2: Validating match for report generation...');
    
    const status = match.match_status?.name || match.match_status?.state || match.match_status;
    const isFinished = ['ft', 'finished', 'ended', 'full-time', 'full time'].includes(status?.toLowerCase());
    
    if (!isFinished) {
      console.error(`❌ Match status "${status}" indicates match is not finished`);
      console.log('   Reports can only be generated for finished matches');
      console.log('   Supported finished statuses: FT, finished, ended, full-time, full time');
      process.exit(1);
    }
    console.log('✅ Match is finished');

    const leagueId = match.league?.id || match.competition?.id;
    const isLeagueCup = leagueId === 27;
    
    if (!isLeagueCup) {
      console.warn(`⚠️ Warning: This is not a League Cup match (ID: ${leagueId})`);
      console.log('   Continuing anyway as all leagues should have reports...');
    } else {
      console.log('✅ Confirmed League Cup match');
    }

    // Check team slugs
    const homeSlug = match.home_team_slug || match.teams?.home?.team_slug;
    const awaySlug = match.away_team_slug || match.teams?.away?.team_slug;
    
    if (!homeSlug || !awaySlug) {
      console.error('❌ Missing team slugs:');
      console.log(`   Home slug: ${homeSlug || 'MISSING'}`);
      console.log(`   Away slug: ${awaySlug || 'MISSING'}`);
      console.log('   Cannot generate reports without team slugs');
      process.exit(1);
    }
    console.log('✅ Team slugs present');

    // Step 3: Generate reports
    console.log('\n🚀 Step 3: Generating missing reports...');
    
    try {
      const reports = await generateBothReports(matchId);
      
      if (reports && reports.length > 0) {
        console.log(`✅ Successfully generated ${reports.length} report(s):`);
        reports.forEach((report, index) => {
          console.log(`   ${index + 1}. ${report.team_slug || report.team_focus} - ${report.headline?.substring(0, 50) || 'Report generated'}...`);
        });
      } else {
        console.error('❌ No reports were generated');
        console.log('   This could be due to:');
        console.log('   - Missing match data (events, player ratings, etc.)');
        console.log('   - API quota limits');
        console.log('   - Database issues');
      }
    } catch (generateError) {
      console.error('❌ Error generating reports:', generateError.message);
      console.log('\n🔧 Troubleshooting suggestions:');
      console.log('   1. Check that match has sufficient data (events, ratings, etc.)');
      console.log('   2. Verify API keys and quotas');
      console.log('   3. Check database connectivity');
      console.log('   4. Review server logs for detailed errors');
    }

    // Step 4: Verify reports were created
    console.log('\n🔍 Step 4: Verifying report creation...');
    
    const newReports = await Report.find({ match_id: matchId }).lean();
    const updatedMatch = await Match.findOne({ match_id: matchId }).lean();
    
    console.log(`Final report count: ${newReports.length}`);
    console.log(`Match reports flags: home=${!!updatedMatch.reports?.home}, away=${!!updatedMatch.reports?.away}`);

    if (newReports.length >= 2) {
      console.log('\n🎉 SUCCESS! Reports have been generated for match 19631550');
      console.log(`   View at: https://thefinalplay.com/${homeSlug}/match/${matchId}/report`);
    } else if (newReports.length === 1) {
      console.log('\n⚠️ PARTIAL SUCCESS: Only one report was generated');
      console.log('   This may be expected if teams have different data availability');
    } else {
      console.log('\n❌ FAILED: No reports were created');
      console.log('   Manual investigation required');
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
  }
}

fixMatch19631550();