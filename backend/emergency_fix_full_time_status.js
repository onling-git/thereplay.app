// Emergency fix for "Full Time" status matches that were missed
require('dotenv').config();
const mongoose = require('mongoose');
const { generateBothReports } = require('./controllers/reportController');

async function fixFullTimeStatusMatches() {
  try {
    console.log('🚨 Emergency Fix: Full Time Status Matches');
    console.log('==========================================\n');

    // Connect to database
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    
    try {
      await mongoose.connect(uri);
      console.log('📊 Connected to database');
    } catch (connectError) {
      console.error('❌ Database connection failed:', connectError.message);
      process.exit(1);
    }

    const Match = require('./models/Match');
    const Report = require('./models/Report');

    // Find all matches with "Full Time" status that might have been missed
    console.log('🔍 Searching for matches with "Full Time" status...');
    
    const cutoffTime = new Date(Date.now() - (72 * 60 * 60 * 1000)); // Last 72 hours
    
    const fullTimeMatches = await Match.find({
      $and: [
        { updatedAt: { $gte: cutoffTime } },
        {
          $or: [
            { 'match_status.name': 'Full Time' },
            { 'match_status.state': 'Full Time' },
            { match_status: 'Full Time' }
          ]
        },
        {
          $or: [
            { 'league.id': { $in: [8, 9, 24, 27, 390, 570, 1371] } },
            { 'match_info.league.id': { $in: [8, 9, 24, 27, 390, 570, 1371] } },
            { 'competition.id': { $in: [8, 9, 24, 27, 390, 570, 1371] } }
          ]
        }
      ]
    }).lean();

    console.log(`📊 Found ${fullTimeMatches.length} matches with "Full Time" status\n`);

    if (fullTimeMatches.length === 0) {
      console.log('✅ No "Full Time" matches found that need fixing');
      return;
    }

    const results = {
      total: fullTimeMatches.length,
      needsReports: 0,
      alreadyHasReports: 0,
      generated: 0,
      errors: 0
    };

    for (const match of fullTimeMatches) {
      try {
        const homeTeam = match.teams?.home?.team_name || match.home_team;
        const awayTeam = match.teams?.away?.team_name || match.away_team;
        const leagueName = match.league?.name || match.match_info?.league?.name || match.competition?.name;
        const leagueId = match.league?.id || match.match_info?.league?.id || match.competition?.id;
        
        console.log(`\n🔍 Checking Match ${match.match_id}: ${homeTeam} vs ${awayTeam}`);
        console.log(`   League: ${leagueName} (ID: ${leagueId})`);
        console.log(`   Date: ${match.date || match.match_info?.starting_at}`);
        
        // Check if reports already exist
        const hasHomeReport = !!match.reports?.home;
        const hasAwayReport = !!match.reports?.away;
        
        if (hasHomeReport && hasAwayReport) {
          console.log('   ✅ Already has both reports');
          results.alreadyHasReports++;
          continue;
        }
        
        // Double-check with Report collection
        const existingReports = await Report.find({ match_id: match.match_id }).lean();
        
        if (existingReports.length >= 2) {
          console.log('   ✅ Has reports in collection (match document may be out of sync)');
          results.alreadyHasReports++;
          continue;
        }
        
        console.log(`   ❌ Missing reports: Home=${!hasHomeReport}, Away=${!hasAwayReport}`);
        results.needsReports++;
        
        // Check if we have team slugs (required for generation)
        const homeSlug = match.home_team_slug || match.teams?.home?.team_slug;
        const awaySlug = match.away_team_slug || match.teams?.away?.team_slug;
        
        if (!homeSlug || !awaySlug) {
          console.log('   ⚠️ Missing team slugs - cannot generate reports');
          console.log(`     Home slug: ${homeSlug || 'MISSING'}`);
          console.log(`     Away slug: ${awaySlug || 'MISSING'}`);
          results.errors++;
          continue;
        }
        
        // Generate missing reports
        console.log('   🚀 Generating reports...');
        try {
          const reports = await generateBothReports(match.match_id);
          
          if (reports && reports.length > 0) {
            console.log(`   ✅ Generated ${reports.length} report(s)`);
            results.generated++;
          } else {
            console.log('   ❌ No reports generated');
            results.errors++;
          }
        } catch (generateError) {
          console.error('   ❌ Generation failed:', generateError.message);
          results.errors++;
        }
        
        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Error processing match ${match.match_id}:`, error.message);
        results.errors++;
      }
    }

    console.log('\n📈 EMERGENCY FIX SUMMARY');
    console.log('========================');
    console.log(`📊 Total matches checked: ${results.total}`);
    console.log(`✅ Already had reports: ${results.alreadyHasReports}`);
    console.log(`❌ Needed reports: ${results.needsReports}`);
    console.log(`🚀 Successfully generated: ${results.generated}`);
    console.log(`⚠️ Errors encountered: ${results.errors}`);

    if (results.generated > 0) {
      console.log(`\n🎉 Fixed ${results.generated} matches that were missed due to "Full Time" status bug!`);
    }

    if (results.errors > 0) {
      console.log(`\n⚠️ ${results.errors} matches still need attention (missing team slugs or other issues)`);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n✅ Database disconnected');
  }
}

fixFullTimeStatusMatches();