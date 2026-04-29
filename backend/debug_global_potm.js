require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

// Copy the global POTM function
function computeGlobalPotmFromRatings(match) {
  const ratings = match.player_ratings || [];
  if (!Array.isArray(ratings) || !ratings.length) return { player: null, rating: null, reason: null };
  
  let best = null;
  for (const r of ratings) {
    if (r.rating == null || isNaN(Number(r.rating))) continue;
    if (!best || Number(r.rating) > Number(best.rating)) best = r;
  }
  if (!best) return { player: null, rating: null, reason: null };
  return { player: best.player || best.player_name || null, rating: Number(best.rating), reason: best.rating !== null ? `Highest rating (${best.rating})` : null };
}

async function debugGlobalPotm() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    
    const match = await Match.findOne({ match_id: 19631550 }).lean();
    
    console.log('=== GLOBAL POTM DEBUG ===');
    
    const global = computeGlobalPotmFromRatings(match);
    console.log('Global POTM:', global);
    
    // Find the actual highest rating
    const allRatings = (match.player_ratings || []).filter(r => r.rating != null && !isNaN(Number(r.rating)));
    allRatings.sort((a, b) => Number(b.rating) - Number(a.rating));
    
    console.log('\n=== TOP 5 RATINGS (ALL TEAMS) ===');
    allRatings.slice(0, 5).forEach((rating, i) => {
      console.log(`${i+1}. ${rating.player || rating.player_name || 'Unknown'} (Team ${rating.team_id}): ${rating.rating}`);
    });
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

debugGlobalPotm();