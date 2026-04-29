require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function debugPlayerIdMatching() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    
    const match = await Match.findOne({ match_id: 19631550 }).lean();
    
    console.log('=== PLAYER ID MATCHING ANALYSIS ===');
    
    // Check lineup structure
    console.log('Lineup structure:');
    console.log('- Has lineup object:', !!match.lineup);
    console.log('- Has lineups array:', !!match.lineups);
    
    if (match.lineup) {
      console.log('- Home players:', (match.lineup.home || []).length);
      console.log('- Away players:', (match.lineup.away || []).length);
      
      // Sample home player
      const sampleHome = (match.lineup.home || [])[0];
      if (sampleHome) {
        console.log('Sample home player:', {
          player_id: sampleHome.player_id,
          player_name: sampleHome.player_name,
          name: sampleHome.name,
          keys: Object.keys(sampleHome)
        });
      }
    }
    
    // Check player_ratings structure  
    console.log('\nPlayer ratings structure:');
    console.log('- Total ratings:', (match.player_ratings || []).length);
    
    const sampleRating = (match.player_ratings || [])[0];
    if (sampleRating) {
      console.log('Sample rating:', {
        player_id: sampleRating.player_id,
        player: sampleRating.player,
        player_name: sampleRating.player_name,
        rating: sampleRating.rating,
        team_id: sampleRating.team_id,
        keys: Object.keys(sampleRating)
      });
    }
    
    // Try manual matching
    console.log('\n=== MANUAL MATCHING TEST ===');
    const allLineupPlayers = [
      ...(match.lineup?.home || []),
      ...(match.lineup?.away || [])
    ];
    
    console.log('All lineup players:', allLineupPlayers.length);
    
    // Try to match first few ratings with lineup
    (match.player_ratings || []).slice(0, 5).forEach((rating, i) => {
      const lineupPlayer = allLineupPlayers.find(p => 
        String(p.player_id) === String(rating.player_id)
      );
      
      console.log(`Rating ${i+1}:`);
      console.log(`  - Rating player_id: ${rating.player_id}`);
      console.log(`  - Found in lineup: ${!!lineupPlayer}`);
      if (lineupPlayer) {
        console.log(`  - Lineup name: ${lineupPlayer.player_name || lineupPlayer.name}`);
        console.log(`  - Rating: ${rating.rating}`);
      }
    });
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugPlayerIdMatching();