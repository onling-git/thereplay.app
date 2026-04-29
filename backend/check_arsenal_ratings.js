require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function checkArsenalRatings() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    
    const match = await Match.findOne({ match_id: 19631550 }).lean();
    
    console.log('=== ARSENAL PLAYER RATINGS ===');
    
    // Find Arsenal team ID
    const arsenalTeamId = 19; // We know this from before
    
    const arsenalRatings = (match.player_ratings || []).filter(r => r.team_id === arsenalTeamId);
    
    console.log('Arsenal ratings found:', arsenalRatings.length);
    arsenalRatings.forEach(rating => {
      console.log(`${rating.player || rating.player_name || 'Unknown'}: ${rating.rating}`);
    });
    
    // Find highest rated Arsenal player
    let highestRated = null;
    arsenalRatings.forEach(rating => {
      if (!highestRated || rating.rating > highestRated.rating) {
        highestRated = rating;
      }
    });
    
    console.log('\n=== HIGHEST RATED ARSENAL PLAYER ===');
    console.log(`Player: ${highestRated?.player || highestRated?.player_name || 'Unknown'}`);
    console.log(`Rating: ${highestRated?.rating}`);
    
    // Also check Zubimendi specifically
    const zubimendi = arsenalRatings.find(r => 
      (r.player && r.player.toLowerCase().includes('zubimendi')) ||
      (r.player_name && r.player_name.toLowerCase().includes('zubimendi'))
    );
    
    console.log('\n=== ZUBIMENDI RATING ===');
    if (zubimendi) {
      console.log(`Zubimendi found: ${zubimendi.player || zubimendi.player_name} - ${zubimendi.rating}`);
    } else {
      console.log('Zubimendi not found in Arsenal ratings');
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkArsenalRatings();