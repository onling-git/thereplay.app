// Regenerate Southampton vs Ipswich match report
// Match: 19432224, Tuesday 28th April 2026, 7:45pm BST
require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Match = require('../models/Match');
const Tweet = require('../models/Tweet');
const Team = require('../models/Team');

async function regenerateReport() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.DBURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('Connected!\n');

    const matchId = 19432224;
    
    // Step 1: Check current state
    console.log('=== STEP 1: Checking current state ===');
    const match = await Match.findOne({ match_id: matchId });
    if (!match) {
      throw new Error('Match not found');
    }
    
    console.log(`Match: ${match.home_team} ${match.score?.home || 0} - ${match.score?.away || 0} ${match.away_team}`);
    console.log(`Date: ${match.date}`);
    console.log(`Player Ratings: ${match.player_ratings?.length || 0}`);
    
    const homeTeamId = match.teams?.home?.team_id || match.home_team_id;
    const awayTeamId = match.teams?.away?.team_id || match.away_team_id;
    
    // Check tweets
    const tweetsWithMatchId = await Tweet.countDocuments({
      match_id: matchId,
      team_id: { $in: [homeTeamId, awayTeamId] },
      $or: [
        { 'collection_context.search_type': 'reporter' },
        { 'collection_context.source_priority': 1 }
      ]
    });
    
    console.log(`\nReporter tweets with match_id: ${tweetsWithMatchId}`);
    
    // Check timeframe tweets (not linked to match)
    // Use match.date which is a Date object
    const matchDate = new Date(match.date);
    if (isNaN(matchDate.getTime())) {
      throw new Error('Match has invalid date');
    }
    
    const searchStart = new Date(matchDate.getTime() - 2 * 60 * 60 * 1000);
    const searchEnd = new Date(matchDate.getTime() + 3 * 60 * 60 * 1000);
    
    console.log(`\nMatch time: ${matchDate.toISOString()}`);
    console.log(`Search window: ${searchStart.toISOString()} to ${searchEnd.toISOString()}`);
    
    const tweetsInTimeframe = await Tweet.countDocuments({
      team_id: { $in: [homeTeamId, awayTeamId] },
      created_at: { $gte: searchStart, $lte: searchEnd },
      $or: [
        { 'collection_context.search_type': 'reporter' },
        { 'collection_context.source_priority': 1 }
      ]
    });
    
    console.log(`Reporter tweets in timeframe (not linked): ${tweetsInTimeframe - tweetsWithMatchId}`);
    
    // Step 2: Link existing timeframe tweets to match
    if (tweetsInTimeframe > tweetsWithMatchId) {
      console.log('\n=== STEP 2: Linking timeframe tweets to match ===');
      
      const result = await Tweet.updateMany(
        {
          team_id: { $in: [homeTeamId, awayTeamId] },
          created_at: { $gte: searchStart, $lte: searchEnd },
          match_id: { $exists: false },
          $or: [
            { 'collection_context.search_type': 'reporter' },
            { 'collection_context.source_priority': 1 }
          ]
        },
        {
          $set: {
            match_id: matchId,
            match_date: match.date
          }
        }
      );
      
      console.log(`Linked ${result.modifiedCount} tweets to match ${matchId}`);
    } else {
      console.log('\n=== STEP 2: All tweets already linked ===');
    }
    
    // Step 3: Check if we need to collect more tweets
    const finalCount = await Tweet.countDocuments({
      match_id: matchId,
      team_id: { $in: [homeTeamId, awayTeamId] },
      $or: [
        { 'collection_context.search_type': 'reporter' },
        { 'collection_context.source_priority': 1 }
      ]
    });
    
    console.log(`\nFinal tweet count: ${finalCount}`);
    
    if (finalCount < 5) {
      console.log('\n⚠️ WARNING: Less than 5 reporter tweets available');
      console.log('The report generation will auto-collect tweets if needed');
    }
    
    // Step 4: Regenerate report via API
    console.log('\n=== STEP 3: Regenerating match report ===');
    
    const baseUrl = process.env.SELF_BASE || 'http://localhost:3001';
    const apiKey = process.env.ADMIN_API_KEY;
    
    if (!apiKey) {
      throw new Error('ADMIN_API_KEY not configured');
    }
    
    console.log(`Calling: POST ${baseUrl}/api/reports/v2/southampton/match/${matchId}/generate-both`);
    
    const response = await axios.post(
      `${baseUrl}/api/reports/v2/southampton/match/${matchId}/generate-both`,
      {},
      {
        headers: {
          'x-api-key': apiKey
        },
        timeout: 120000 // 2 minutes
      }
    );
    
    console.log('\n✅ Report generation completed!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ ERROR:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
  }
}

regenerateReport();
