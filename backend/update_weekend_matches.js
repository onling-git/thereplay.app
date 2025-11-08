require('dotenv').config();
const { connectDB } = require('./db/connect');
const { syncFinishedMatch } = require('./controllers/matchSyncController');
const Match = require('./models/Match');

// List of match IDs from last weekend
const matchIds = [
  19431902, // Wrexham vs Coventry City (0-0)
  19431901, // West Bromwich Albion vs Sheffield Wednesday (0-0)
  19431899, // Stoke City vs Bristol City (5-1)
  19596414, // Peterborough United vs Cardiff City (1-0)
  19596397, // Blackpool vs Scunthorpe United (1-0)
  19431895, // Oxford United vs Millwall (2-2)
  19431897, // Sheffield United vs Derby County (1-3)
  19427552, // Nottingham Forest vs Manchester United (2-2)
  19596416, // Rotherham United vs Swindon Town (1-2)
  19596426, // Wycombe Wanderers vs Plymouth Argyle (2-0)
  19431896, // Queens Park Rangers vs Ipswich Town (1-4)
  19431891, // Birmingham City vs Portsmouth (4-0)
  19427546, // Brighton & Hove Albion vs Leeds United (3-0)
  19427547, // Burnley vs Arsenal (0-2)
  19427548, // Crystal Palace vs Brentford (2-0)
  19427549, // Fulham vs Wolverhampton Wanderers (3-0)
  19431900, // Watford vs Middlesbrough (3-0)
  19431892, // Charlton Athletic vs Swansea City (1-1)
  19427554, // Tottenham Hotspur vs Chelsea (0-1)
  19427550, // Liverpool vs Aston Villa (0-0)
  19427555  // West Ham United vs Newcastle United (3-1)
];

async function updateAndVerifyMatches() {
  try {
    await connectDB(process.env.DBURI || process.env.MONGO_URI);
    
    console.log(`🔄 Updating and verifying ${matchIds.length} matches from last weekend...\n`);
    
    let updated = 0;
    let errors = 0;
    let dataIssues = [];
    
    for (const matchId of matchIds) {
      try {
        console.log(`\n--- Processing Match ${matchId} (${updated + 1}/${matchIds.length}) ---`);
        
        // Get current match data to show before/after
        const beforeMatch = await Match.findOne({ match_id: matchId }, {
          match_id: 1,
          'teams.home.team_name': 1,
          'teams.away.team_name': 1,
          'score.home': 1,
          'score.away': 1,
          lineup: 1,
          player_ratings: 1,
          commentary: 1,
          status: 1
        });
        
        if (!beforeMatch) {
          console.log(`  ❌ Match ${matchId} not found in database`);
          errors++;
          continue;
        }
        
        const homeTeam = beforeMatch.teams?.home?.team_name || 'Unknown';
        const awayTeam = beforeMatch.teams?.away?.team_name || 'Unknown';
        const beforeScore = beforeMatch.score ? `${beforeMatch.score.home}-${beforeMatch.score.away}` : 'No score';
        
        console.log(`  📊 ${homeTeam} vs ${awayTeam} (Current: ${beforeScore})`);
        
        // Step 1: Sync finished match data (this will update scores, lineups, ratings, commentary)
        console.log(`  1. Syncing match data from API...`);
        await syncFinishedMatch(matchId, { forFinished: true });
        console.log(`  ✓ Match data synced from API`);
        
        // Step 2: Verify updated data
        const afterMatch = await Match.findOne({ match_id: matchId }, {
          match_id: 1,
          'teams.home.team_name': 1,
          'teams.away.team_name': 1,
          'score.home': 1,
          'score.away': 1,
          lineup: 1,
          player_ratings: 1,
          commentary: 1,
          status: 1
        });
        
        const afterScore = afterMatch.score ? `${afterMatch.score.home}-${afterMatch.score.away}` : 'No score';
        
        // Check for score changes
        if (beforeScore !== afterScore) {
          console.log(`  📈 Score updated: ${beforeScore} → ${afterScore}`);
        } else {
          console.log(`  📊 Score unchanged: ${afterScore}`);
        }
        
        // Verify data completeness
        const issues = [];
        
        // Check lineup
        const homeLineupCount = afterMatch.lineup?.home?.length || 0;
        const awayLineupCount = afterMatch.lineup?.away?.length || 0;
        if (homeLineupCount === 0 || awayLineupCount === 0) {
          issues.push(`Missing lineups (home: ${homeLineupCount}, away: ${awayLineupCount})`);
        } else {
          console.log(`  👥 Lineups: home=${homeLineupCount}, away=${awayLineupCount}`);
        }
        
        // Check player ratings
        const ratingsCount = afterMatch.player_ratings?.length || 0;
        if (ratingsCount === 0) {
          issues.push(`No player ratings (${ratingsCount})`);
        } else {
          console.log(`  ⭐ Player ratings: ${ratingsCount}`);
        }
        
        // Check commentary (stored in 'comments' field, not 'commentary')
        const commentaryCount = afterMatch.comments?.length || 0;
        if (commentaryCount === 0) {
          issues.push(`No commentary (${commentaryCount})`);
        } else {
          console.log(`  💬 Commentary events: ${commentaryCount}`);
        }
        
        // Check status (stored in match_status object)
        const status = afterMatch.match_status?.short_name || afterMatch.match_status?.state || afterMatch.status;
        if (!status || status === 'NS') {
          issues.push(`Status: ${status || 'undefined'}`);
        } else {
          console.log(`  🏁 Status: ${status}`);
        }
        
        if (issues.length > 0) {
          console.log(`  ⚠️  Data issues found:`);
          issues.forEach(issue => console.log(`     - ${issue}`));
          dataIssues.push({
            matchId,
            homeTeam,
            awayTeam,
            issues
          });
        } else {
          console.log(`  ✅ All data looks good`);
        }
        
        updated++;
        console.log(`  ✅ Match ${matchId} processed successfully`);
        
        // Add a small delay to avoid overwhelming the API
        if (updated < matchIds.length) {
          console.log(`  ⏳ Waiting 1 second before next match...`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        errors++;
        console.error(`  ❌ Error processing match ${matchId}:`, error.message);
        
        // Continue with next match even if this one fails
        continue;
      }
    }
    
    console.log(`\n🎉 Match data update complete!`);
    console.log(`✅ Successfully updated: ${updated} matches`);
    console.log(`❌ Errors: ${errors} matches`);
    console.log(`📊 Success rate: ${((updated / matchIds.length) * 100).toFixed(1)}%`);
    
    if (dataIssues.length > 0) {
      console.log(`\n⚠️  Matches with data issues (${dataIssues.length}):`);
      dataIssues.forEach(({ matchId, homeTeam, awayTeam, issues }) => {
        console.log(`\n  ${matchId}: ${homeTeam} vs ${awayTeam}`);
        issues.forEach(issue => console.log(`    - ${issue}`));
      });
      
      console.log(`\n💡 Note: Some matches may be missing data from the API provider.`);
      console.log(`You may want to investigate these before generating reports.`);
    } else {
      console.log(`\n✨ All matches have complete data and are ready for report generation!`);
    }
    
    process.exit();
  } catch (err) {
    console.error('Fatal error:', err);
    process.exit(1);
  }
}

console.log('🔄 Weekend Fixtures Data Update & Verification Script');
console.log('====================================================');
console.log('This script will update and verify all English league matches');
console.log('from last weekend (October 31 - November 2, 2025).');
console.log('');
console.log('For each match, it will:');
console.log('1. Sync latest match data from SportMonks API');
console.log('2. Update scores, lineups, player ratings, and commentary');
console.log('3. Apply lineup normalization fixes');
console.log('4. Verify data completeness before report generation');
console.log('');

updateAndVerifyMatches();