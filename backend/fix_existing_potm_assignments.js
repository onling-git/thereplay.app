// Fix any existing incorrect POTM assignments in reports
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

async function fixExistingPotmAssignments() {
  await connectDB();
  
  try {
    console.log('🔧 Checking for and fixing existing incorrect POTM assignments...\n');
    
    // Find all matches with POTM data
    const matchesWithPotm = await Match.find({
      'potm.home.player': { $ne: null, $ne: '' },
      'potm.away.player': { $ne: null, $ne: '' }
    }).lean();
    
    let totalFixed = 0;
    let totalChecked = 0;
    
    for (const match of matchesWithPotm) {
      const reports = await Report.find({ match_id: match.match_id });
      
      for (const report of reports) {
        totalChecked++;
        
        const reportTeamName = String(report.team_focus || '').toLowerCase();
        const homeTeamName = String(match.home_team || match.teams?.home?.team_name || '').toLowerCase();
        const awayTeamName = String(match.away_team || match.teams?.away?.team_name || '').toLowerCase();
        
        const isHomeReport = reportTeamName === homeTeamName;
        const isAwayReport = reportTeamName === awayTeamName;
        
        let needsUpdate = false;
        let newPotm = null;
        
        if (isHomeReport && match.potm?.home?.player && report.potm?.player !== match.potm.home.player) {
          needsUpdate = true;
          newPotm = {
            player: match.potm.home.player,
            rating: match.potm.home.rating,
            reason: match.potm.home.reason || `Highest rating (${match.potm.home.rating})`,
            sources: report.potm?.sources || {}
          };
          console.log(`🔧 Fixing home report for ${match.home_team || match.teams?.home?.team_name} vs ${match.away_team || match.teams?.away?.team_name}`);
          console.log(`   Old: ${report.potm?.player} -> New: ${newPotm.player}`);
        } else if (isAwayReport && match.potm?.away?.player && report.potm?.player !== match.potm.away.player) {
          needsUpdate = true;
          newPotm = {
            player: match.potm.away.player,
            rating: match.potm.away.rating,
            reason: match.potm.away.reason || `Highest rating (${match.potm.away.rating})`,
            sources: report.potm?.sources || {}
          };
          console.log(`🔧 Fixing away report for ${match.home_team || match.teams?.home?.team_name} vs ${match.away_team || match.teams?.away?.team_name}`);
          console.log(`   Old: ${report.potm?.player} -> New: ${newPotm.player}`);
        }
        
        if (needsUpdate) {
          await Report.findByIdAndUpdate(report._id, { $set: { potm: newPotm } });
          totalFixed++;
          console.log(`   ✅ Updated report ${report._id}`);
        }
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Reports checked: ${totalChecked}`);
    console.log(`   Reports fixed: ${totalFixed}`);
    
    if (totalFixed === 0) {
      console.log(`   ✅ All reports already have correct team-specific POTM assignments!`);
    } else {
      console.log(`   🔧 Fixed ${totalFixed} incorrect POTM assignments`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing POTM assignments:', error);
  } finally {
    mongoose.connection.close();
  }
}

// Run the fix if this script is executed directly
if (require.main === module) {
  fixExistingPotmAssignments().catch(console.error);
}

module.exports = { fixExistingPotmAssignments };