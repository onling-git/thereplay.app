require('dotenv').config();
const { connectDB } = require('./db/connect');
const { syncFinishedMatch } = require('./controllers/matchSyncController');
const { generateBothReports } = require('./controllers/reportController');
const Match = require('./models/Match');

async function updateWeekendMatches() {
  try {
    await connectDB(process.env.DBURI || process.env.MONGO_URI);
    
    console.log('🏆 WEEKEND FIXTURES UPDATE & REPORT GENERATION');
    console.log('===============================================\n');
    
    // Find all weekend matches (Oct 31 - Nov 3, 2025) for Premier League and Championship
    const weekendStart = new Date('2025-10-31T00:00:00.000Z');
    const weekendEnd = new Date('2025-11-03T23:59:59.999Z');
    
    console.log(`📅 Finding weekend matches (${weekendStart.toDateString()} - ${weekendEnd.toDateString()})...`);
    
    const weekendMatches = await Match.find({
      date: {
        $gte: weekendStart,
        $lte: weekendEnd
      },
      $or: [
        { 'match_info.league.name': 'Premier League' },
        { 'match_info.league.name': 'Championship' }
      ]
    }, {
      match_id: 1,
      'teams.home.team_name': 1,
      'teams.away.team_name': 1,
      date: 1,
      'match_info.league.name': 1,
      'score.home': 1,
      'score.away': 1,
      'match_status.short_name': 1,
      'reports.home': 1,
      'reports.away': 1
    }).sort({ date: 1 }).lean();
    
    console.log(`✅ Found ${weekendMatches.length} weekend matches\n`);
    
    if (weekendMatches.length === 0) {
      console.log('❌ No weekend matches found. Exiting.');
      process.exit(0);
    }
    
    // Show matches summary
    console.log('📋 WEEKEND MATCHES SUMMARY:');
    console.log('===========================');
    weekendMatches.forEach((match, i) => {
      const home = match.teams?.home?.team_name || 'Unknown';
      const away = match.teams?.away?.team_name || 'Unknown';
      const score = `${match.score?.home || 0}-${match.score?.away || 0}`;
      const status = match.match_status?.short_name || 'Unknown';
      const league = match.match_info?.league?.name || 'Unknown';
      const date = new Date(match.date).toLocaleDateString();
      const hasReports = (match.reports?.home || match.reports?.away) ? '📄' : '❌';
      
      console.log(`  ${i + 1}. ${home} vs ${away} (${score}) - ${status} - ${league} - ${date} ${hasReports}`);
    });
    
    console.log('\n🔄 UPDATING MATCHES WITH FIXED SYNC PROCESS...');
    console.log('================================================\n');
    
    let updated = 0;
    let errors = 0;
    let skipped = 0;
    
    for (const match of weekendMatches) {
      const home = match.teams?.home?.team_name || 'Unknown';
      const away = match.teams?.away?.team_name || 'Unknown';
      
      try {
        console.log(`🔄 Processing: ${home} vs ${away} (${match.match_id})...`);
        
        // Run the fixed sync process
        await syncFinishedMatch(match.match_id);
        
        // Check what was updated
        const updatedMatch = await Match.findOne({ match_id: match.match_id }, {
          'score.home': 1,
          'score.away': 1,
          'match_status.short_name': 1
        }).lean();
        
        const newScore = `${updatedMatch.score?.home || 0}-${updatedMatch.score?.away || 0}`;
        const newStatus = updatedMatch.match_status?.short_name || 'Unknown';
        
        console.log(`  ✅ Updated: ${newScore} (${newStatus})`);
        updated++;
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        errors++;
      }
      
      // Small delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n📊 UPDATE SUMMARY:');
    console.log('==================');
    console.log(`✅ Updated: ${updated} matches`);
    console.log(`❌ Errors: ${errors} matches`);
    console.log(`➖ Skipped: ${skipped} matches`);
    
    if (updated === 0) {
      console.log('\n❌ No matches were updated. Exiting without generating reports.');
      process.exit(1);
    }
    
    console.log('\n🎯 GENERATING REPORTS FOR UPDATED MATCHES...');
    console.log('=============================================\n');
    
    // Now generate reports for all matches that have FT status
    const completedMatches = await Match.find({
      match_id: { $in: weekendMatches.map(m => m.match_id) },
      'match_status.short_name': 'FT'
    }, {
      match_id: 1,
      'teams.home.team_name': 1,
      'teams.away.team_name': 1,
      'score.home': 1,
      'score.away': 1,
      'reports.home': 1,
      'reports.away': 1
    }).lean();
    
    console.log(`📝 Found ${completedMatches.length} completed matches ready for reports\n`);
    
    let reportsGenerated = 0;
    let reportErrors = 0;
    
    for (const match of completedMatches) {
      const home = match.teams?.home?.team_name || 'Unknown';
      const away = match.teams?.away?.team_name || 'Unknown';
      const score = `${match.score?.home || 0}-${match.score?.away || 0}`;
      
      try {
        console.log(`📝 Generating reports: ${home} vs ${away} (${score})...`);
        
        // Generate both home and away reports
        const result = await generateBothReports(match.match_id);
        
        if (result && (result.homeReportId || result.awayReportId)) {
          console.log(`  ✅ Generated: ${result.homeReportId ? 'Home ✓' : ''} ${result.awayReportId ? 'Away ✓' : ''}`);
          reportsGenerated++;
        } else {
          console.log(`  ⚠️  No reports generated (may already exist)`);
        }
        
      } catch (error) {
        console.log(`  ❌ Report error: ${error.message}`);
        reportErrors++;
      }
      
      // Small delay between reports
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log('\n🎉 FINAL SUMMARY:');
    console.log('=================');
    console.log(`📊 Total weekend matches: ${weekendMatches.length}`);
    console.log(`🔄 Sync updates: ${updated} successful, ${errors} errors`);
    console.log(`📝 Report generation: ${reportsGenerated} successful, ${reportErrors} errors`);
    console.log(`✅ Process complete!`);
    
    process.exit(0);
    
  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  }
}

updateWeekendMatches();