// Check when Southampton tweets were collected
require('dotenv').config();
const mongoose = require('mongoose');
const Tweet = require('../models/Tweet');

async function checkTweetTimes() {
  try {
    await mongoose.connect(process.env.DBURI);
    
    const matchDate = new Date('2026-04-28T18:45:00.000Z');
    const searchStart = new Date(matchDate.getTime() - 2 * 60 * 60 * 1000);
    const searchEnd = new Date(matchDate.getTime() + 3 * 60 * 60 * 1000);
    
    const homeTeamId = 65; // Southampton
    const awayTeamId = 116; // Ipswich
    
    // Get all timeframe tweets with details
    const tweets = await Tweet.find({
      team_id: { $in: [homeTeamId, awayTeamId] },
      created_at: { $gte: searchStart, $lte: searchEnd }
    })
    .sort({ created_at: 1 })
    .limit(40)
    .lean();
    
    console.log(`Found ${tweets.length} tweets in timeframe\n`);
    
    // Group by search_type
    const byType = {};
    tweets.forEach(t => {
      const type = t.collection_context?.search_type || 'unknown';
      byType[type] = (byType[type] || 0) + 1;
    });
    
    console.log('=== Tweets by Type ===');
    Object.entries(byType).forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });
    
    // Check when they were collected
    console.log('\n=== Collection Times ===');
    tweets.forEach(t => {
      const collected = t.api_response_meta?.collected_at;
      const created = t.created_at;
      console.log(`Tweet created: ${created.toISOString()} | Collected: ${collected ? collected.toISOString() : 'UNKNOWN'} | Type: ${t.collection_context?.search_type || 'unknown'}`);
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

checkTweetTimes();
