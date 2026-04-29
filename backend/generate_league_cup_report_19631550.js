// Manual report generation for match 19631550 (League Cup)
require('dotenv').config();
const mongoose = require('mongoose');
const { generateBothReports } = require('./controllers/reportController');

async function generateLeagueCupReport() {
  try {
    console.log('🏆 Manual League Cup Report Generation');
    console.log('=====================================');
    
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    
    try {
      await mongoose.connect(uri);
      console.log('📊 Connected to database');
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError.message);
      console.log('\n💡 SOLUTION WITHOUT DATABASE ACCESS:');
      console.log('To manually generate the report for match 19631550:');
      console.log('\n1. Check if the match exists in the database');
      console.log('2. Verify the match status is "finished" or "FT"');
      console.log('3. Ensure team slugs are properly set');
      console.log('4. Run: node scripts/regenerate_reports_for_match.js 19631550');
      console.log('5. Check cron job logs for any errors during automated processing');
      
      console.log('\n🔧 LIKELY ROOT CAUSE:');
      console.log('Based on code analysis, League Cup matches SHOULD be processed automatically.');
      console.log('The most likely issues are:');
      console.log('- Match status was not "finished" when cron ran last night');
      console.log('- Missing or invalid team slugs preventing report generation');
      console.log('- Temporary API or database issues during processing');
      return;
    }

    const matchId = 19631550;
    console.log(`\n🎯 Generating reports for match ${matchId}...`);
    
    // Try to generate both reports
    const reports = await generateBothReports(matchId);
    
    if (reports && reports.length > 0) {
      console.log(`\n✅ Successfully generated ${reports.length} report(s):`);
      reports.forEach((report, index) => {
        console.log(`   ${index + 1}. ${report.teamSlug || report.team_focus} - ${report.headline || 'Report generated'}`);
      });
      
      console.log(`\n🔗 Reports should now be available at:`);
      console.log(`   - Home team: http://localhost:3000/[team-slug]/match/${matchId}/report`);
      console.log(`   - Away team: http://localhost:3000/[team-slug]/match/${matchId}/report`);
    } else {
      console.log('\n❌ No reports were generated');
      console.log('\n🔍 This could indicate:');
      console.log('   - Reports already exist for this match');
      console.log('   - Missing essential match data (team info, status, etc.)');
      console.log('   - Match not found in database');
    }

  } catch (error) {
    console.error('\n❌ Error generating reports:', error.message);
    
    if (error.message.includes('Match not found')) {
      console.log('\n💡 MATCH NOT FOUND SOLUTION:');
      console.log('1. Verify the match ID 19631550 is correct');
      console.log('2. Check if the match was properly synced from the API');
      console.log('3. Run the cup sync script to ensure all League Cup matches are in the database');
    } else if (error.message.includes('team')) {
      console.log('\n💡 TEAM ISSUE SOLUTION:');
      console.log('1. Check if team slugs are properly set in the match document');
      console.log('2. Verify teams exist in the Teams collection');
      console.log('3. Ensure team names are properly formatted');
    } else {
      console.log('\n💡 GENERAL TROUBLESHOOTING:');
      console.log('1. Check match data quality (events, ratings, etc.)');
      console.log('2. Verify match status is "finished"');
      console.log('3. Check for any API rate limiting issues');
      console.log('4. Review application logs for more details');
    }
    
  } finally {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('\n📊 Database disconnected');
    }
  }
}

console.log('Starting manual report generation for League Cup match 19631550...\n');
generateLeagueCupReport();