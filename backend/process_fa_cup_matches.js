// FA Cup Match Report Generator - Process all finished FA Cup matches
require('dotenv').config();
const mongoose = require('mongoose');
const { generateBothReports } = require('./controllers/reportController');
const Match = require('./models/Match');

async function processFACupMatches() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    console.log('📊 Connected to database');

    console.log('🏆 FA Cup Match Report Generator');
    console.log('=====================================');
    
    // Find all finished FA Cup matches without reports
    const matches = await Match.find({
      'match_info.league.id': 24, // FA Cup
      'match_status.name': 'Full Time',
      $or: [
        { 'reports.home': { $exists: false } },
        { 'reports.away': { $exists: false } },
        { 'reports.home': null },
        { 'reports.away': null }
      ]
    }).select('match_id teams match_info match_status reports').sort({ 'match_info.starting_at': -1 }).limit(10);

    console.log(`📊 Found ${matches.length} finished FA Cup matches without reports\n`);

    let processed = 0;
    let errors = 0;

    for (const match of matches) {
      try {
        const homeTeam = match.teams?.home?.team_name || 'Unknown';
        const awayTeam = match.teams?.away?.team_name || 'Unknown';
        
        console.log(`\n--- Processing Match ${match.match_id} (${processed + 1}/${matches.length}) ---`);
        console.log(`   ${homeTeam} vs ${awayTeam}`);
        console.log(`   Date: ${match.match_info?.starting_at || 'Unknown'}`);
        
        // Generate both home and away reports
        const reports = await generateBothReports(match.match_id);
        
        if (reports && reports.length > 0) {
          console.log(`   ✅ Generated ${reports.length} report(s)`);
          reports.forEach((report, index) => {
            console.log(`      ${index + 1}. ${report.teamSlug} - ${report.headline?.substring(0, 50) || 'Report generated'}...`);
          });
          processed++;
        } else {
          console.log('   ❌ No reports were generated');
          errors++;
        }

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`   ❌ Error processing match ${match.match_id}: ${error.message}`);
        errors++;
      }
    }

    console.log('\n🏆 FA Cup Report Generation Summary');
    console.log('=====================================');
    console.log(`📊 Matches processed: ${processed}`);
    console.log(`❌ Errors: ${errors}`);
    console.log(`📝 Total matches found: ${matches.length}`);

    if (processed > 0) {
      console.log('\n🔗 View reports at:');
      matches.slice(0, 5).forEach(match => {
        const homeSlug = match.teams?.home?.team_slug || 'team';
        console.log(`   http://localhost:3000/${homeSlug}/match/${match.match_id}/report`);
      });
    }

  } catch (error) {
    console.error('❌ Error processing FA Cup matches:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📊 Disconnected from database');
  }
}

processFACupMatches();