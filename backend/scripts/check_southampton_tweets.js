// Check Southampton tweet situation
require('dotenv').config();
const mongoose = require('mongoose');
const Tweet = require('../models/Tweet');
const Team = require('../models/Team');

async function checkTweets() {
  try {
    await mongoose.connect(process.env.DBURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    const matchId = 19432224;
    const homeTeamId = 65; // Southampton
    const awayTeamId = 116; // Ipswich
    
    // Match date: 2026-04-28T18:45:00.000Z (7:45pm BST = 6:45pm UTC)
    const matchDate = new Date('2026-04-28T18:45:00.000Z');
    const searchStart = new Date(matchDate.getTime() - 2 * 60 * 60 * 1000);
    const searchEnd = new Date(matchDate.getTime() + 3 * 60 * 60 * 1000);
    
    console.log('Match date:', matchDate.toISOString());
    console.log('Search window:', searchStart.toISOString(), 'to', searchEnd.toISOString());
    console.log();
    
    // All tweets for these teams
    const allTeamTweets = await Tweet.countDocuments({
      team_id: { $in: [homeTeamId, awayTeamId] }
    });
    console.log(`Total tweets for Southampton/Ipswich: ${allTeamTweets}`);
    
    // Tweets in timeframe (any type)
    const timeframeTweets = await Tweet.countDocuments({
      team_id: { $in: [homeTeamId, awayTeamId] },
      created_at: { $gte: searchStart, $lte: searchEnd }
    });
    console.log(`Tweets in match timeframe: ${timeframeTweets}`);
    
    // Reporter tweets in timeframe
    const reporterTimeframeTweets = await Tweet.countDocuments({
      team_id: { $in: [homeTeamId, awayTeamId] },
      created_at: { $gte: searchStart, $lte: searchEnd },
      'collection_context.search_type': 'reporter'
    });
    console.log(`Reporter tweets in timeframe: ${reporterTimeframeTweets}`);
    
    // Tweets with match_id
    const matchLinkedTweets = await Tweet.countDocuments({
      match_id: matchId
    });
    console.log(`Tweets linked to match: ${matchLinkedTweets}`);
    
    // Sample timeframe tweets to see what type they are
    const timeframeSamples = await Tweet.find({
      team_id: { $in: [homeTeamId, awayTeamId] },
      created_at: { $gte: searchStart, $lte: searchEnd }
    }).limit(10).lean();
    
    console.log('\n=== Timeframe Tweets (first 10) ===');
    for (const tweet of timeframeSamples) {
      console.log(`\nTweet: ${tweet.content?.substring(0, 80) || 'NO CONTENT'}...`);
      console.log(`Created: ${tweet.created_at?.toISOString()}`);
      console.log(`Team: ${tweet.team_name} (${tweet.team_id})`);
      console.log(`Search type: ${tweet.collection_context?.search_type || 'NOT SET'}`);
      console.log(`Source priority: ${tweet.collection_context?.source_priority || 'NOT SET'}`);
      console.log(`Username: ${tweet.user?.username || 'NOT SET'}`);
    }
    
    // Sample some tweets
    const sampleTweets = await Tweet.find({
      team_id: { $in: [homeTeamId, awayTeamId] }
    }).limit(5).lean();
    
    console.log('\n=== Sample Tweets ===');
    for (const tweet of sampleTweets) {
      console.log(`\nTweet ID: ${tweet.tweet_id}`);
      console.log(`Created: ${tweet.created_at?.toISOString() || 'NO DATE'}`);
      console.log(`Team: ${tweet.team_name} (${tweet.team_id})`);
      console.log(`Match ID: ${tweet.match_id || 'NOT SET'}`);
      console.log(`Search type: ${tweet.collection_context?.search_type || 'NOT SET'}`);
    }
    
    // Check team reporter config
    console.log('\n=== Team Reporter Config ===');
    const southampton = await Team.findOne({ id: 65 });
    const ipswich = await Team.findOne({ id: 116 });
    
    console.log(`Southampton reporters: ${southampton?.twitter?.reporters?.length || 0}`);
    if (southampton?.twitter?.reporters) {
      console.log('  ', southampton.twitter.reporters.map(r => r.handle).join(', '));
    }
    
    console.log(`Ipswich reporters: ${ipswich?.twitter?.reporters?.length || 0}`);
    if (ipswich?.twitter?.reporters) {
      console.log('  ', ipswich.twitter.reporters.map(r => r.handle).join(', '));
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

checkTweets();
