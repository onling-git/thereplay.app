require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

// Copy the POTM logic from reportController to debug what potmForReport contains
async function debugPotmForReport() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    
    const match = await Match.findOne({ match_id: 19631550 }).lean();
    const targetTeamName = 'Arsenal';
    
    console.log('=== DEBUGGING POTM FOR REPORT (Arsenal) ===');
    
    // Copy the exact logic from reportController
    let potmForReport = { player: null, rating: null, reason: null, sources: {} };

    if (Array.isArray(match.player_ratings) && match.player_ratings.length) {
      // Import the functions (would be defined in actual code)
      const { computePotmFromRatings } = require('./controllers/reportController');
      
      const derived = computePotmFromRatings(match);
      console.log('Derived POTM:', derived);
      
      // decide whether this report is for the home side or away side by comparing the targetTeamName
      const tName = String(targetTeamName || '').toLowerCase();
      const homeName = String(match.home_team || '').toLowerCase();
      const awayName = String(match.away_team || '').toLowerCase();
      const nestedHomeName = (match.teams && match.teams.home && String(match.teams.home.team_name || '').toLowerCase()) || '';
      const nestedAwayName = (match.teams && match.teams.away && String(match.teams.away.team_name || '').toLowerCase()) || '';
      const isHomeFocus = (tName && (tName === homeName || tName === nestedHomeName));

      console.log('Team matching:');
      console.log('- Target:', tName);
      console.log('- Home:', homeName);
      console.log('- Away:', awayName);  
      console.log('- Nested home:', nestedHomeName);
      console.log('- Nested away:', nestedAwayName);
      console.log('- Is home focus:', isHomeFocus);

      const chosen = isHomeFocus ? derived.home : derived.away;
      console.log('Chosen POTM:', chosen);
      
      if (!potmForReport.player && chosen && chosen.player) {
        potmForReport = { player: chosen.player || null, rating: chosen.rating ?? null, reason: chosen.reason || null, sources: {} };
        console.log('Set potmForReport from chosen:', potmForReport);
      } else if (!potmForReport.player) {
        console.log('Falling back to global POTM...');
        // fallback: use the global highest if team-specific is not available
        // We'd need to implement computeGlobalPotmFromRatings here
      }
    }
    
    console.log('Final potmForReport:', potmForReport);
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugPotmForReport();