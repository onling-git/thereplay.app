// Comprehensive weekend match processing for Premier League and Championship
// October 31st - November 2nd, 2025
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');
const { generateBothReports } = require('./controllers/reportController');

const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';

async function processWeekendMatches() {
  try {
    await mongoose.connect(uri);
    console.log('🏆 Processing Weekend Matches: Oct 31 - Nov 2, 2025\n');

    // Date range: Friday Oct 31 - Sunday Nov 2, 2025
    const startDate = new Date('2025-10-31T00:00:00Z');
    const endDate = new Date('2025-11-02T23:59:59Z');

    console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    // Find all Premier League (8) and Championship (9) matches in date range
    const matches = await Match.find({
      'match_info.league.id': { $in: [8, 9] }, // Premier League and Championship
      date: { $gte: startDate, $lte: endDate },
      'match_status.name': 'Full Time' // Only finished matches
    }).select('match_id teams match_info lineup lineups reports potm player_ratings score date match_status');

    console.log(`📊 Found ${matches.length} finished matches to process\n`);

    let stats = {
      total: matches.length,
      alreadyPerfect: 0,
      lineupNormalized: 0,
      reportsRegenerated: 0,
      obsoleteFieldsRemoved: 0,
      errors: 0
    };

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      let needsReportRegeneration = false;
      let changesNeeded = [];

      console.log(`\n[${i + 1}/${matches.length}] Processing Match ${match.match_id}`);
      console.log(`   🏟️  ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
      console.log(`   🏆 ${match.match_info?.league?.name}`);
      console.log(`   📅 ${new Date(match.date).toISOString().split('T')[0]}`);

      try {
        // === STEP 1: Check and normalize lineup data ===
        const homeTeamId = match.teams?.home?.team_id;
        const awayTeamId = match.teams?.away?.team_id;

        if (!match.lineup || !match.lineup.home || !match.lineup.away || 
            match.lineup.home.length === 0 || match.lineup.away.length === 0) {
          
          if (match.lineups && match.lineups.length > 0 && homeTeamId && awayTeamId) {
            console.log('   🔧 Normalizing lineup structure...');
            
            const homePlayers = match.lineups.filter(p => p.team_id === homeTeamId);
            const awayPlayers = match.lineups.filter(p => p.team_id === awayTeamId);
            
            if (homePlayers.length >= 5 && awayPlayers.length >= 5) {
              // Normalize lineup structure
              match.lineup = {
                home: homePlayers.map(p => ({
                  player_id: p.player_id,
                  player_name: p.player_name || p.player?.display_name || p.player?.name || '',
                  jersey_number: p.jersey_number,
                  position_id: p.position_id,
                  rating: p.rating || null
                })),
                away: awayPlayers.map(p => ({
                  player_id: p.player_id,
                  player_name: p.player_name || p.player?.display_name || p.player?.name || '',
                  jersey_number: p.jersey_number,
                  position_id: p.position_id,
                  rating: p.rating || null
                }))
              };
              
              await match.save();
              console.log(`   ✅ Lineup normalized: ${homePlayers.length} home, ${awayPlayers.length} away`);
              changesNeeded.push('lineup_normalized');
              stats.lineupNormalized++;
              needsReportRegeneration = true;
            } else {
              console.log(`   ⚠️  Insufficient player data: ${homePlayers.length} home, ${awayPlayers.length} away`);
              changesNeeded.push('insufficient_lineup_data');
            }
          } else {
            console.log('   ❌ No lineup data available for normalization');
            changesNeeded.push('no_lineup_data');
          }
        } else {
          console.log(`   ✅ Lineup already normalized: ${match.lineup.home.length} home, ${match.lineup.away.length} away`);
        }

        // === STEP 2: Check data quality for reports ===
        let dataQualityIssues = [];

        // Check scores
        if (!match.score || typeof match.score.home !== 'number' || typeof match.score.away !== 'number') {
          dataQualityIssues.push('missing_scores');
        }

        // Check lineup player names
        if (match.lineup?.home) {
          const missingNames = match.lineup.home.filter(p => !p.player_name || p.player_name.trim() === '');
          if (missingNames.length > 0) {
            dataQualityIssues.push(`missing_home_player_names(${missingNames.length})`);
          }
        }

        if (match.lineup?.away) {
          const missingNames = match.lineup.away.filter(p => !p.player_name || p.player_name.trim() === '');
          if (missingNames.length > 0) {
            dataQualityIssues.push(`missing_away_player_names(${missingNames.length})`);
          }
        }

        // Check player ratings
        if (!match.player_ratings || match.player_ratings.length === 0) {
          dataQualityIssues.push('missing_player_ratings');
        }

        // Check POTM
        if (!match.potm || !match.potm.home?.player || !match.potm.away?.player) {
          dataQualityIssues.push('missing_potm');
        }

        if (dataQualityIssues.length > 0) {
          console.log(`   ⚠️  Data quality issues: ${dataQualityIssues.join(', ')}`);
          needsReportRegeneration = true;
          changesNeeded.push(...dataQualityIssues);
        }

        // === STEP 3: Check if reports exist and need regeneration ===
        const hasReports = match.reports && match.reports.home && match.reports.away;
        
        if (!hasReports) {
          console.log('   📝 No reports exist - will generate');
          needsReportRegeneration = true;
          changesNeeded.push('missing_reports');
        } else if (dataQualityIssues.length > 0) {
          console.log('   🔄 Reports exist but data quality issues found - will regenerate');
          needsReportRegeneration = true;
        } else {
          console.log('   ✅ Reports exist with good data quality');
        }

        // === STEP 4: Remove obsolete fields ===
        let obsoleteRemoved = false;
        const obsoleteFields = ['old_lineup', 'legacy_data', 'temp_field', 'deprecated_scores'];
        
        for (const field of obsoleteFields) {
          if (match[field] !== undefined) {
            match[field] = undefined;
            obsoleteRemoved = true;
          }
        }

        if (obsoleteRemoved) {
          await match.save();
          console.log('   🧹 Removed obsolete fields');
          stats.obsoleteFieldsRemoved++;
        }

        // === STEP 5: Regenerate reports if needed ===
        if (needsReportRegeneration && match.lineup?.home?.length > 0 && match.lineup?.away?.length > 0) {
          console.log('   🔄 Regenerating reports...');
          
          try {
            const reports = await generateBothReports(match.match_id);
            if (reports) {
              console.log('   ✅ Reports regenerated successfully');
              stats.reportsRegenerated++;
              
              // Update team documents
              const homeSlug = match.teams?.home?.team_slug;
              const awaySlug = match.teams?.away?.team_slug;
              
              if (homeSlug) {
                await Team.updateOne(
                  { slug: homeSlug },
                  { 
                    last_match_info: {
                      match_id: match.match_id,
                      opponent: match.teams.away.team_name,
                      date: match.date,
                      is_home: true
                    }
                  }
                );
              }
              
              if (awaySlug) {
                await Team.updateOne(
                  { slug: awaySlug },
                  { 
                    last_match_info: {
                      match_id: match.match_id,
                      opponent: match.teams.home.team_name,
                      date: match.date,
                      is_home: false
                    }
                  }
                );
              }
            } else {
              console.log('   ❌ Report regeneration failed');
              stats.errors++;
            }
          } catch (reportError) {
            console.log(`   ❌ Report generation error: ${reportError.message}`);
            stats.errors++;
          }
        } else if (changesNeeded.length === 0) {
          console.log('   🎉 Match data is already perfect - no action needed');
          stats.alreadyPerfect++;
        }

        console.log(`   📋 Changes: ${changesNeeded.length > 0 ? changesNeeded.join(', ') : 'none'}`);

      } catch (error) {
        console.error(`   ❌ Error processing match ${match.match_id}: ${error.message}`);
        stats.errors++;
      }
    }

    // === FINAL SUMMARY ===
    console.log('\n' + '='.repeat(80));
    console.log('🎯 WEEKEND MATCH PROCESSING COMPLETE');
    console.log('='.repeat(80));
    console.log(`📊 Total matches processed: ${stats.total}`);
    console.log(`✅ Already perfect: ${stats.alreadyPerfect}`);
    console.log(`🔧 Lineups normalized: ${stats.lineupNormalized}`);
    console.log(`📝 Reports regenerated: ${stats.reportsRegenerated}`);
    console.log(`🧹 Obsolete fields removed: ${stats.obsoleteFieldsRemoved}`);
    console.log(`❌ Errors encountered: ${stats.errors}`);
    console.log('\n🎉 All weekend matches have been processed and optimized!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

processWeekendMatches();