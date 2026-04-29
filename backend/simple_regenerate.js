// Simple script to regenerate reports using existing data
// Skips tweet collection, only updates player ratings and regenerates
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

console.log('🔍 Environment check:');
console.log('   OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? `${process.env.OPENAI_API_KEY.substring(0, 15)}...` : 'NOT SET');
console.log('   SPORTMONKS_API_KEY:', process.env.SPORTMONKS_API_KEY ? 'SET' : 'NOT SET');
console.log('   DBURI:', process.env.DBURI ? 'SET' : 'NOT SET');
console.log('');

const mongoose = require('mongoose');
const axios = require('axios');
const Match = require('./models/Match');
const Report = require('./models/Report');
const { generateBothReports } = require('./controllers/reportController');

const MATCH_IDS = [19432260, 19432257];
const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const SPORTMONKS_BASE = process.env.SPORTMONKS_BASE || 'https://api.sportmonks.com/v3/football';

async function fetchPlayerRatings(matchId) {
  try {
    console.log(`📊 Fetching player ratings for match ${matchId}...`);
    
    const url = `${SPORTMONKS_BASE}/fixtures/${matchId}`;
    const response = await axios.get(url, {
      params: {
        api_token: SPORTMONKS_API_KEY,
        include: 'lineups.details'
      }
    });
    
    const fixture = response.data?.data;
    if (!fixture) {
      console.log(`❌ No fixture data returned`);
      return [];
    }
    
    const ratings = [];
    
    if (fixture.lineups && Array.isArray(fixture.lineups)) {
      for (const lineup of fixture.lineups) {
        // Look for type_id 118 (RATING type)
        const ratingDetail = lineup.details?.find(d => d.type_id === 118);
        
        if (ratingDetail && ratingDetail.data?.value) {
          ratings.push({
            player: lineup.player_name || null,
            player_id: lineup.player_id,
            rating: Number(ratingDetail.data.value),
            team_id: lineup.team_id,
            team: null,
            inferred: false,
            source: 'sportmonks-lineup-detail',
            calculated_at: new Date()
          });
        }
      }
    }
    
    console.log(`✅ Found ${ratings.length} player ratings`);
    return ratings;
    
  } catch (error) {
    console.error(`❌ Error fetching player ratings:`, error.response?.data || error.message);
    return [];
  }
}

async function main() {
  console.log('🔄 Starting simple report regeneration...\n');
  console.log('Match IDs:', MATCH_IDS.join(', '));
  console.log('');
  
  await mongoose.connect(process.env.DBURI);
  console.log('✅ Connected to MongoDB\n');
  
  for (const matchId of MATCH_IDS) {
    console.log('='.repeat(80));
    console.log(`📋 Processing Match ID: ${matchId}`);
    console.log('='.repeat(80));
    
    try {
      const match = await Match.findOne({ match_id: matchId });
      if (!match) {
        console.error(`❌ Match ${matchId} not found in database`);
        continue;
      }
      
      console.log(`Match: ${match.teams?.home?.team_name || 'Home'} vs ${match.teams?.away?.team_name || 'Away'}`);
      console.log(`Date: ${match.date}`);
      console.log(`Score: ${match.score?.home ?? 0} - ${match.score?.away ?? 0}`);
      
      // Fetch and update player ratings
      const playerRatings = await fetchPlayerRatings(matchId);
      if (playerRatings.length > 0) {
        await Match.updateOne(
          { match_id: matchId },
          { $set: { player_ratings: playerRatings } }
        );
        console.log(`✅ Updated match with ${playerRatings.length} player ratings`);
      }
      
      // Delete existing reports
      console.log(`\n🗑️  Deleting existing reports...`);
      const deleteResult = await Report.deleteMany({ match_id: matchId });
      console.log(`   Deleted ${deleteResult.deletedCount} reports`);
      
      // Clear reports references
      await Match.updateOne(
        { match_id: matchId },
        { $unset: { 'reports.home': '', 'reports.away': '' } }
      );
      console.log(`   Cleared match.reports fields`);
      
      // Regenerate reports
      console.log(`\n📝 Regenerating reports...`);
      const reports = await generateBothReports(matchId);
      
      console.log(`✅ Generated ${reports.length} reports:`);
      reports.forEach(r => {
        console.log(`   - ${r.team_focus}: ${r.headline?.substring(0, 60)}...`);
        console.log(`     MOTM: ${r.man_of_the_match || 'N/A'}`);
        console.log(`     Tweets used: ${r.embedded_tweets?.length || 0}`);
      });
      
    } catch (error) {
      console.error(`❌ Error processing match ${matchId}:`, error.message);
      console.error(error.stack);
    }
    
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('✅ Processing complete');
  
  await mongoose.disconnect();
  console.log('✅ Disconnected from MongoDB');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
