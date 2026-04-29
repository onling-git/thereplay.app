// Force regenerate reports for match 19631550 to test the rating fix
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Report = require('./models/Report');
const { generateReportFor } = require('./controllers/reportController');

async function forceRegenerate() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    console.log('📊 Connected to database');

    const matchId = 19631550;
    
    // Get match data
    const match = await Match.findOne({ match_id: matchId }).lean();
    if (!match) {
      console.error('❌ Match not found');
      return;
    }

    console.log(`🎯 Match: ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
    
    // Delete existing reports completely
    console.log('🗑️ Deleting existing reports...');
    await Report.deleteMany({ match_id: matchId });
    
    // Force clear match.reports field
    await Match.updateOne(
      { match_id: matchId },
      { $unset: { "reports": "" } }
    );
    
    console.log('✅ Cleared all existing report references');
    
    // Generate new reports
    console.log('\n🔄 Generating new reports with fixed player name resolution...');
    
    try {
      // Generate Arsenal report (away team)
      console.log('Generating Arsenal (away) report...');
      const arsenalReport = await generateReportFor(matchId, 'arsenal');
      console.log('✅ Arsenal report generated');
      
      // Generate Chelsea report (home team)
      console.log('Generating Chelsea (home) report...');
      const chelseaReport = await generateReportFor(matchId, 'chelsea');
      console.log('✅ Chelsea report generated');
      
      // Check the new reports
      const newReports = await Report.find({ match_id: matchId });
      console.log(`\n📊 Generated ${newReports.length} new reports`);
      
      // Check for correct player ratings
      console.log('\n🔍 CHECKING CORRECTED RATINGS:');
      newReports.forEach((report, index) => {
        console.log(`\n--- ${report.team_focus.toUpperCase()} REPORT ---`);
        
        if (report.content) {
          const content = report.content;
          
          // Look for Gyökeres mentions
          const gyokeresMatches = content.match(/[Gg]yökeres[^.]*?(rating|[0-9]+\.[0-9]+)/gi);
          if (gyokeresMatches) {
            console.log('🎯 Gyökeres mentions:', gyokeresMatches);
          }
          
          // Look for Garnacho mentions
          const garnachoMatches = content.match(/[Gg]arnacho[^.]*?(rating|[0-9]+\.[0-9]+)/gi);
          if (garnachoMatches) {
            console.log('⭐ Garnacho mentions:', garnachoMatches);
          }
          
          // Look for Player of the Match section
          const potmMatch = content.match(/Player of the Match:[^.]*?([0-9]+\.[0-9]+)/i);
          if (potmMatch) {
            console.log('🏆 Player of the Match rating:', potmMatch[0]);
          }
        }
      });
      
    } catch (genError) {
      console.error('❌ Report generation failed:', genError.message);
    }
    
    console.log('\n✅ Test complete');
    mongoose.disconnect();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

forceRegenerate();