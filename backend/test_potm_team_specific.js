// Test script to verify POTM (Player of the Match) is team-specific in reports
require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Report = require('./models/Report');

async function connectDB() {
  if (mongoose.connection.readyState !== 1) {
    await mongoose.connect(process.env.DBURI);
    console.log('📊 Connected to MongoDB');
  }
}

async function testPotmTeamSpecific() {
  await connectDB();
  
  try {
    console.log('🎯 Testing POTM team-specific assignment in reports...\n');
    
    // Find a match that has both home and away reports
    const matchWithReports = await Match.findOne({
      'potm.home.player': { $ne: null, $ne: '' },
      'potm.away.player': { $ne: null, $ne: '' },
      $or: [
        { home_team: { $ne: null, $ne: '' } },
        { 'teams.home.team_name': { $ne: null, $ne: '' } }
      ]
    }).lean();
    
    if (!matchWithReports) {
      console.log('❌ No matches found with both home and away POTM assigned');
      return;
    }
    
    console.log(`📊 Testing Match: ${matchWithReports.home_team || matchWithReports.teams?.home?.team_name} vs ${matchWithReports.away_team || matchWithReports.teams?.away?.team_name}`);
    console.log(`   Match ID: ${matchWithReports.match_id}`);
    console.log(`   Home POTM: ${matchWithReports.potm?.home?.player} (${matchWithReports.potm?.home?.rating})`);
    console.log(`   Away POTM: ${matchWithReports.potm?.away?.player} (${matchWithReports.potm?.away?.rating})`);
    
    // Find reports for this match
    const reports = await Report.find({ match_id: matchWithReports.match_id }).lean();
    
    if (reports.length === 0) {
      console.log('❌ No reports found for this match');
      return;
    }
    
    console.log(`\n📋 Found ${reports.length} report(s):`);
    
    let correctAssignments = 0;
    let totalReports = 0;
    
    for (const report of reports) {
      totalReports++;
      console.log(`\n   Report for: ${report.team_focus} (${report.team_slug})`);
      console.log(`   Report POTM: ${report.potm?.player} (Rating: ${report.potm?.rating})`);
      
      // Determine if this report is for home or away team
      const reportTeamName = String(report.team_focus || '').toLowerCase();
      const homeTeamName = String(matchWithReports.home_team || matchWithReports.teams?.home?.team_name || '').toLowerCase();
      const awayTeamName = String(matchWithReports.away_team || matchWithReports.teams?.away?.team_name || '').toLowerCase();
      
      const isHomeReport = reportTeamName === homeTeamName;
      const isAwayReport = reportTeamName === awayTeamName;
      
      if (isHomeReport) {
        console.log(`   Expected: ${matchWithReports.potm.home.player} (Home team POTM)`);
        if (report.potm?.player === matchWithReports.potm.home.player) {
          console.log(`   ✅ CORRECT: Home report has home team POTM`);
          correctAssignments++;
        } else {
          console.log(`   ❌ ERROR: Home report should have home team POTM`);
          console.log(`   Expected: ${matchWithReports.potm.home.player}`);
          console.log(`   Actual: ${report.potm?.player}`);
        }
      } else if (isAwayReport) {
        console.log(`   Expected: ${matchWithReports.potm.away.player} (Away team POTM)`);
        if (report.potm?.player === matchWithReports.potm.away.player) {
          console.log(`   ✅ CORRECT: Away report has away team POTM`);
          correctAssignments++;
        } else {
          console.log(`   ❌ ERROR: Away report should have away team POTM`);
          console.log(`   Expected: ${matchWithReports.potm.away.player}`);
          console.log(`   Actual: ${report.potm?.player}`);
        }
      } else {
        console.log(`   ⚠️  WARNING: Could not determine if this is home or away report`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Total reports: ${totalReports}`);
    console.log(`   Correct POTM assignments: ${correctAssignments}`);
    console.log(`   Incorrect assignments: ${totalReports - correctAssignments}`);
    
    if (correctAssignments === totalReports) {
      console.log(`   ✅ All POTM assignments are team-specific and correct!`);
    } else {
      console.log(`   ❌ Some POTM assignments are incorrect and need fixing`);
    }
    
    // Test multiple matches
    console.log(`\n🔍 Testing multiple matches for broader validation...`);
    
    const multipleMatches = await Match.find({
      'potm.home.player': { $ne: null, $ne: '' },
      'potm.away.player': { $ne: null, $ne: '' },
      $or: [
        { home_team: { $ne: null, $ne: '' } },
        { 'teams.home.team_name': { $ne: null, $ne: '' } }
      ]
    }).limit(5).lean();
    
    let totalCorrect = 0;
    let totalReportsChecked = 0;
    
    for (const match of multipleMatches) {
      const matchReports = await Report.find({ match_id: match.match_id }).lean();
      
      for (const report of matchReports) {
        totalReportsChecked++;
        
        const reportTeamName = String(report.team_focus || '').toLowerCase();
        const homeTeamName = String(match.home_team || match.teams?.home?.team_name || '').toLowerCase();
        const awayTeamName = String(match.away_team || match.teams?.away?.team_name || '').toLowerCase();
        
        const isHomeReport = reportTeamName === homeTeamName;
        const isAwayReport = reportTeamName === awayTeamName;
        
        if (isHomeReport && report.potm?.player === match.potm.home.player) {
          totalCorrect++;
        } else if (isAwayReport && report.potm?.player === match.potm.away.player) {
          totalCorrect++;
        }
      }
    }
    
    console.log(`   Checked ${totalReportsChecked} reports across ${multipleMatches.length} matches`);
    console.log(`   Correct assignments: ${totalCorrect}/${totalReportsChecked} (${Math.round(totalCorrect/totalReportsChecked*100)}%)`);
    
  } catch (error) {
    console.error('❌ Error testing POTM assignment:', error);
  } finally {
    mongoose.connection.close();
  }
}

testPotmTeamSpecific().catch(console.error);