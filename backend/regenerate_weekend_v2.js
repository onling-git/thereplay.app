// Regenerate weekend matches using V2 pipeline (2-step process)
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mongoose = require('mongoose');
const axios = require('axios');
const Match = require('./models/Match');
const Report = require('./models/Report');
const { generateReportPipeline } = require('./services/reportPipeline');
const { saveReportToDatabase } = require('./controllers/reportControllerV2');

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
    if (!fixture?.lineups) {
      console.log('⚠️ No lineups found');
      return [];
    }

    const ratings = [];
    
    fixture.lineups.forEach(lineup => {
      // Find the rating detail (type_id: 118)
      const ratingDetail = lineup.details?.find(d => d.type_id === 118);
      
      if (ratingDetail && ratingDetail.data?.value) {
        const rating = Number(ratingDetail.data.value);
        
        if (!isNaN(rating) && rating > 0) {
          ratings.push({
            player: lineup.player_name,
            player_id: lineup.player_id,
            rating: rating,
            team_id: lineup.team_id,
            team: lineup.team_name || 'Unknown',
            inferred: false,
            source: 'sportmonks-lineup-detail',
            calculated_at: new Date()
          });
        }
      }
    });

    console.log(`✅ Found ${ratings.length} player ratings`);
    return ratings;
    
  } catch (error) {
    console.error(`❌ Error fetching player ratings:`, error.message);
    return [];
  }
}

async function regenerateMatch(matchId) {
  console.log('\n' + '='.repeat(80));
  console.log(`📊 Processing Match ID: ${matchId}`);
  console.log('='.repeat(80));
  
  // Get match details
  const match = await Match.findOne({ match_id: matchId });
  if (!match) {
    console.log(`❌ Match ${matchId} not found`);
    return;
  }
  
  console.log(`Match: ${match.home_team} vs ${match.away_team}`);
  console.log(`Date: ${new Date(match.date)}`);
  console.log(`Score: ${match.score?.fulltime?.home || 0} - ${match.score?.fulltime?.away || 0}`);
  
  // Step 1: Fetch and update player ratings
  const playerRatings = await fetchPlayerRatings(matchId);
  if (playerRatings.length > 0) {
    await Match.updateOne(
      { match_id: matchId },
      { 
        $set: { 
          player_ratings: playerRatings,
          'match_info.ratings_updated_at': new Date()
        }
      }
    );
    console.log(`✅ Updated match with ${playerRatings.length} player ratings\n`);
  }
  
  // Step 2: Delete existing reports
  console.log('🗑️  Deleting existing reports...');
  const deleteResult = await Report.deleteMany({ match_id: matchId });
  console.log(`   Deleted ${deleteResult.deletedCount} reports`);
  
  // Clear report references from match
  await Match.updateOne(
    { match_id: matchId },
    { $unset: { reports: "" } }
  );
  console.log('   Cleared match.reports fields\n');
  
  // Step 3: Generate reports using V2 pipeline (2-step process)
  console.log('📝 Regenerating reports using V2 pipeline...\n');
  
  const homeSlug = match.home_team_slug || `__home_${matchId}`;
  const awaySlug = match.away_team_slug || `__away_${matchId}`;
  
  const reports = [];
  
  // Generate HOME report
  try {
    console.log(`🏠 Generating HOME report for ${match.home_team}...`);
    const homeResult = await generateReportPipeline({
      matchId,
      teamSlug: homeSlug,
      options: { 
        autoCollectTweets: true,
        minTweetsRequired: 5
      }
    });
    
    const savedHomeReport = await saveReportToDatabase({
      report: homeResult.report,
      matchId,
      teamSlug: homeSlug,
      metadata: homeResult.metadata
    });
    
    console.log(`✅ HOME report generated`);
    reports.push(savedHomeReport);
  } catch (error) {
    console.error(`❌ Error generating HOME report:`, error.message);
  }
  
  // Generate AWAY report
  try {
    console.log(`\n✈️  Generating AWAY report for ${match.away_team}...`);
    const awayResult = await generateReportPipeline({
      matchId,
      teamSlug: awaySlug,
      options: { 
        autoCollectTweets: true,
        minTweetsRequired: 5
      }
    });
    
    const savedAwayReport = await saveReportToDatabase({
      report: awayResult.report,
      matchId,
      teamSlug: awaySlug,
      metadata: awayResult.metadata
    });
    
    console.log(`✅ AWAY report generated`);
    reports.push(savedAwayReport);
  } catch (error) {
    console.error(`❌ Error generating AWAY report:`, error.message);
  }
  
  // Summary
  console.log('\n✅ Generated reports:');
  reports.forEach(r => {
    console.log(`   - ${r.team_focus}: ${r.headline?.substring(0, 60)}...`);
    console.log(`     MOTM: ${r.player_of_the_match?.player || 'N/A'}`);
    console.log(`     Tweets used: ${r.embedded_tweets?.length || 0}`);
  });
}

async function main() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');
    
    for (const matchId of MATCH_IDS) {
      await regenerateMatch(matchId);
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('✅ Processing complete');
    console.log('='.repeat(80));
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

main();
