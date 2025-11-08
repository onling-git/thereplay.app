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

async function fixPotmAssignment() {
  await connectDB();
  
  try {
    const matchId = 19427546;
    console.log(`🎯 Fixing POTM assignment for Brighton vs Leeds match ${matchId}...\n`);
    
    const match = await Match.findOne({ match_id: matchId });
    if (!match) {
      console.error('❌ Match not found');
      return;
    }
    
    console.log(`📊 Match: ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
    console.log(`   Home Team ID: ${match.home_team_id}`);
    console.log(`   Away Team ID: ${match.away_team_id}`);
    
    // Current POTM status
    console.log('\n🏆 Current POTM:');
    if (match.potm?.home) {
      console.log(`   Home: ${match.potm.home.player} (Rating: ${match.potm.home.rating})`);
    }
    if (match.potm?.away) {
      console.log(`   Away: ${match.potm.away.player} (Rating: ${match.potm.away.rating})`);
    }
    
    // Find best players for each team from SportMonks lineups
    if (match.lineups && match.lineups.length > 0) {
      console.log('\n🔍 Finding best players from each team...');
      
      const homeTeamId = match.home_team_id; // Leeds United (71)
      const awayTeamId = match.away_team_id; // Brighton (78)
      
      // Get all players with ratings for each team
      const homePlayers = match.lineups
        .filter(p => p.team_id === homeTeamId && p.details && p.details.length > 0)
        .map(p => {
          const ratingDetail = p.details.find(d => d.type_id === 118 && d.data && d.data.value);
          return {
            player_id: p.player_id,
            player_name: p.player_name,
            team_id: p.team_id,
            rating: ratingDetail ? Number(ratingDetail.data.value) : null
          };
        })
        .filter(p => p.rating !== null)
        .sort((a, b) => b.rating - a.rating);
      
      const awayPlayers = match.lineups
        .filter(p => p.team_id === awayTeamId && p.details && p.details.length > 0)
        .map(p => {
          const ratingDetail = p.details.find(d => d.type_id === 118 && d.data && d.data.value);
          return {
            player_id: p.player_id,
            player_name: p.player_name,
            team_id: p.team_id,
            rating: ratingDetail ? Number(ratingDetail.data.value) : null
          };
        })
        .filter(p => p.rating !== null)
        .sort((a, b) => b.rating - a.rating);
      
      console.log(`   🏠 Home (Leeds) players with ratings: ${homePlayers.length}`);
      console.log(`   🌊 Away (Brighton) players with ratings: ${awayPlayers.length}`);
      
      // Show top 3 players from each team
      console.log('\n📊 Top performers:');
      console.log('   🏠 Home (Leeds) top 3:');
      homePlayers.slice(0, 3).forEach((p, i) => {
        console.log(`     ${i+1}. ${p.player_name} - ${p.rating}`);
      });
      
      console.log('   🌊 Away (Brighton) top 3:');
      awayPlayers.slice(0, 3).forEach((p, i) => {
        console.log(`     ${i+1}. ${p.player_name} - ${p.rating}`);
      });
      
      // Fix POTM assignments
      const bestHome = homePlayers[0];
      const bestAway = awayPlayers[0];
      
      if (bestHome && bestAway) {
        console.log('\n🔧 Fixing POTM assignments...');
        
        // Initialize potm if it doesn't exist
        if (!match.potm) {
          match.potm = {};
        }
        
        // Assign correct home POTM (Leeds player)
        match.potm.home = {
          player: bestHome.player_name,
          rating: bestHome.rating,
          reason: `Highest rating (${bestHome.rating})`,
          source: 'provider'
        };
        
        // Assign correct away POTM (Brighton player)
        match.potm.away = {
          player: bestAway.player_name,
          rating: bestAway.rating,
          reason: `Highest rating (${bestAway.rating})`,
          source: 'provider'
        };
        
        console.log(`   ✅ Home POTM: ${bestHome.player_name} (${bestHome.rating}) - Leeds United`);
        console.log(`   ✅ Away POTM: ${bestAway.player_name} (${bestAway.rating}) - Brighton`);
        
        // Save to database
        console.log('\n💾 Saving corrected POTM assignments...');
        await Match.findOneAndUpdate(
          { match_id: matchId },
          { $set: { potm: match.potm } }
        );
        
        console.log('✅ POTM assignments corrected and saved!');
        
        // Verification
        console.log('\n🔍 Final verification:');
        const updatedMatch = await Match.findOne({ match_id: matchId });
        
        if (updatedMatch.potm) {
          console.log('   🏆 Updated POTM:');
          if (updatedMatch.potm.home) {
            console.log(`     Home: ${updatedMatch.potm.home.player} (Rating: ${updatedMatch.potm.home.rating})`);
          }
          if (updatedMatch.potm.away) {
            console.log(`     Away: ${updatedMatch.potm.away.player} (Rating: ${updatedMatch.potm.away.rating})`);
          }
        }
        
        // Verify team assignments are correct
        console.log('\n✅ Team verification:');
        console.log(`   Home team (${match.teams?.home?.team_name}): ${updatedMatch.potm.home?.player}`);
        console.log(`   Away team (${match.teams?.away?.team_name}): ${updatedMatch.potm.away?.player}`);
        
      } else {
        console.error('❌ Could not find best players for both teams');
      }
      
    } else {
      console.error('❌ No SportMonks lineups data available');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    mongoose.connection.close();
  }
}

fixPotmAssignment();