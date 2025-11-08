require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('✅ Connected to MongoDB Atlas');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

async function fixLineupTeamAssignments() {
  await connectDB();
  
  try {
    console.log('🔧 Fixing lineup team assignments for all weekend matches...\n');
    
    // Get all matches that were processed earlier
    const startDate = new Date('2025-10-31T00:00:00Z');
    const endDate = new Date('2025-11-02T23:59:59Z');
    
    const matches = await Match.find({
      $and: [
        {
          $or: [
            { date: { $gte: startDate, $lte: endDate } },
            { 'match_info.starting_at': { $gte: startDate, $lte: endDate } }
          ]
        },
        {
          $or: [
            { 'teams.home.team_name': { $regex: /Arsenal|Liverpool|Chelsea|Manchester|Tottenham|Newcastle|Crystal Palace|Everton|Leicester|Aston Villa|West Ham|Southampton|Burnley|Sheffield|Fulham|Brentford|Bournemouth|Luton|Brighton|Leeds|Norwich|Birmingham|Coventry|Hull|Ipswich|Middlesbrough|Millwall|Preston|Queens Park Rangers|Rotherham|Stoke|Sunderland|Swansea|Watford|West Bromwich|Cardiff|Reading|Blackburn|Derby|Huddersfield|Wigan/i } },
            { 'teams.away.team_name': { $regex: /Arsenal|Liverpool|Chelsea|Manchester|Tottenham|Newcastle|Crystal Palace|Everton|Leicester|Aston Villa|West Ham|Southampton|Burnley|Sheffield|Fulham|Brentford|Bournemouth|Luton|Brighton|Leeds|Norwich|Birmingham|Coventry|Hull|Ipswich|Middlesbrough|Millwall|Preston|Queens Park Rangers|Rotherham|Stoke|Sunderland|Swansea|Watford|West Bromwich|Cardiff|Reading|Blackburn|Derby|Huddersfield|Wigan/i } },
            { 'league_id': { $in: [8, 9] } }
          ]
        },
        {
          'lineups': { $exists: true, $ne: [] },
          'lineup': { $exists: true }
        }
      ]
    });

    console.log(`📊 Found ${matches.length} matches to fix\n`);

    let fixedMatches = 0;
    let totalPlayersMoved = 0;

    for (const match of matches) {
      const matchId = match.match_id;
      const homeTeam = match.teams?.home?.team_name || 'Home';
      const awayTeam = match.teams?.away?.team_name || 'Away';
      const homeTeamId = match.teams?.home?.team_id;
      const awayTeamId = match.teams?.away?.team_id;
      
      console.log(`🏈 Processing ${matchId}: ${homeTeam} vs ${awayTeam}`);
      
      if (!homeTeamId || !awayTeamId) {
        console.log(`   ❌ Missing team IDs`);
        continue;
      }
      
      if (!match.lineups || !match.lineup) {
        console.log(`   ❌ Missing lineup data`);
        continue;
      }
      
      // Create correct lineup assignments based on team_id from SportMonks data
      const correctHomeLineup = [];
      const correctAwayLineup = [];
      
      // Get all current lineup players (from both home and away arrays)
      const allCurrentPlayers = (match.lineup.home || []).concat(match.lineup.away || []);
      
      // Reassign each player to correct team based on SportMonks team_id
      for (const player of allCurrentPlayers) {
        // Find this player in SportMonks data to get their team_id
        const smPlayer = match.lineups.find(sm => sm.player_id === player.player_id);
        
        if (smPlayer) {
          // Add team_id to the player object for future reference
          const playerWithTeam = {
            ...player,
            team_id: smPlayer.team_id
          };
          
          // Assign to correct team array
          if (smPlayer.team_id === homeTeamId) {
            correctHomeLineup.push(playerWithTeam);
          } else if (smPlayer.team_id === awayTeamId) {
            correctAwayLineup.push(playerWithTeam);
          } else {
            console.log(`   ⚠️  Player ${player.player_name} has unknown team_id: ${smPlayer.team_id}`);
          }
        } else {
          console.log(`   ⚠️  Player ${player.player_name} not found in SportMonks data`);
        }
      }
      
      console.log(`   📊 Reassignment: ${correctHomeLineup.length} home, ${correctAwayLineup.length} away`);
      
      // Check if there were mixing issues
      const currentHomeCount = match.lineup.home?.length || 0;
      const currentAwayCount = match.lineup.away?.length || 0;
      
      const homeChanged = correctHomeLineup.length !== currentHomeCount;
      const awayChanged = correctAwayLineup.length !== currentAwayCount;
      
      if (homeChanged || awayChanged) {
        console.log(`   🔄 Fixed mixing: ${currentHomeCount}→${correctHomeLineup.length} home, ${currentAwayCount}→${correctAwayLineup.length} away`);
        
        // Update the lineup with correct assignments
        match.lineup = {
          home: correctHomeLineup,
          away: correctAwayLineup
        };
        
        // Save to database
        await Match.findOneAndUpdate(
          { match_id: matchId },
          { $set: { lineup: match.lineup } }
        );
        
        fixedMatches++;
        totalPlayersMoved += Math.abs(correctHomeLineup.length - currentHomeCount) + Math.abs(correctAwayLineup.length - currentAwayCount);
        
        console.log(`   ✅ Fixed and saved`);
      } else {
        console.log(`   ✅ No mixing issues`);
      }
    }
    
    console.log('\n📈 Team Assignment Fix Summary:');
    console.log(`   🏈 Matches checked: ${matches.length}`);
    console.log(`   🔧 Matches fixed: ${fixedMatches}`);
    console.log(`   👥 Player reassignments: ${totalPlayersMoved / 2} players moved`); // Divide by 2 since each move counts twice
    
    // Verify one match to confirm fix
    if (fixedMatches > 0) {
      console.log('\n🔍 Verification (Brighton vs Leeds):');
      const verifyMatch = await Match.findOne({ match_id: 19427546 });
      
      if (verifyMatch && verifyMatch.lineup) {
        console.log(`   🏠 Home (Brighton): ${verifyMatch.lineup.home?.length} players`);
        console.log(`   🌊 Away (Leeds): ${verifyMatch.lineup.away?.length} players`);
        
        // Check first player from each team
        const homePlayer = verifyMatch.lineup.home?.[0];
        const awayPlayer = verifyMatch.lineup.away?.[0];
        
        if (homePlayer) {
          console.log(`   🏠 Home sample: ${homePlayer.player_name} (Team: ${homePlayer.team_id})`);
        }
        
        if (awayPlayer) {
          console.log(`   🌊 Away sample: ${awayPlayer.player_name} (Team: ${awayPlayer.team_id})`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixLineupTeamAssignments();