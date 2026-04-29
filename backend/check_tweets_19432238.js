// Check if tweets exist for match 19432238
require('dotenv').config();
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');
const Match = require('./models/Match');

async function checkTweets() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const matchId = 19432238;

    // Get match details
    const match = await Match.findOne({ match_id: matchId }).lean();
    if (!match) {
      console.log('❌ Match not found');
      return;
    }

    console.log('📋 MATCH DETAILS');
    console.log('='.repeat(80));
    console.log('Match ID:', match.match_id);
    console.log('Home Team:', match.home_team || match.teams?.home?.team_name);
    console.log('Away Team:', match.away_team || match.teams?.away?.team_name);
    console.log('Date:', match.date);
    console.log('');

    // Get team IDs
    const homeTeamId = match.teams?.home?.team_id || match.home_team_id;
    const awayTeamId = match.teams?.away?.team_id || match.away_team_id;
    
    console.log('Home Team ID:', homeTeamId);
    console.log('Away Team ID:', awayTeamId);
    console.log('');

    // Search for tweets by match_id
    console.log('🔍 SEARCHING FOR TWEETS');
    console.log('='.repeat(80));
    
    const tweetsByMatchId = await Tweet.find({ match_id: matchId }).lean();
    console.log(`\nTweets with match_id=${matchId}: ${tweetsByMatchId.length}`);
    
    if (tweetsByMatchId.length > 0) {
      tweetsByMatchId.forEach((tweet, i) => {
        console.log(`\n[${i + 1}] Tweet ID: ${tweet.tweet_id}`);
        console.log(`Text: ${tweet.text.substring(0, 100)}...`);
        console.log(`Author: ${tweet.author?.userName || 'unknown'}`);
        console.log(`Created: ${tweet.created_at}`);
      });
    }

    // Search by team_id
    console.log('\n');
    console.log('🏠 HOME TEAM TWEETS');
    console.log('='.repeat(80));
    const homeTweets = await Tweet.find({ team_id: homeTeamId }).lean();
    console.log(`Found ${homeTweets.length} tweets for home team (${homeTeamId})`);
    
    if (homeTweets.length > 0) {
      homeTweets.slice(0, 3).forEach((tweet, i) => {
        console.log(`\n[${i + 1}] Tweet ID: ${tweet.tweet_id}`);
        console.log(`Text: ${tweet.text.substring(0, 100)}...`);
        console.log(`Match ID: ${tweet.match_id}`);
      });
    }

    console.log('\n');
    console.log('⚽ AWAY TEAM TWEETS');
    console.log('='.repeat(80));
    const awayTweets = await Tweet.find({ team_id: awayTeamId }).lean();
    console.log(`Found ${awayTweets.length} tweets for away team (${awayTeamId})`);
    
    if (awayTweets.length > 0) {
      awayTweets.slice(0, 3).forEach((tweet, i) => {
        console.log(`\n[${i + 1}] Tweet ID: ${tweet.tweet_id}`);
        console.log(`Text: ${tweet.text.substring(0, 100)}...`);
        console.log(`Match ID: ${tweet.match_id}`);
      });
    }

    // Check match date range
    console.log('\n');
    console.log('📅 TWEETS AROUND MATCH DATE');
    console.log('='.repeat(80));
    
    const matchDate = new Date(match.date);
    const dayBefore = new Date(matchDate);
    dayBefore.setDate(dayBefore.getDate() - 1);
    const dayAfter = new Date(matchDate);
    dayAfter.setDate(dayAfter.getDate() + 1);
    
    console.log('Match date:', matchDate);
    console.log('Searching from:', dayBefore, 'to', dayAfter);
    
    const tweetsAroundDate = await Tweet.find({
      $or: [{ team_id: homeTeamId }, { team_id: awayTeamId }],
      created_at: { $gte: dayBefore, $lte: dayAfter }
    }).lean();
    
    console.log(`\nFound ${tweetsAroundDate.length} tweets around match date`);
    
    if (tweetsAroundDate.length > 0) {
      tweetsAroundDate.slice(0, 5).forEach((tweet, i) => {
        console.log(`\n[${i + 1}] Tweet ID: ${tweet.tweet_id}`);
        console.log(`Text: ${tweet.text.substring(0, 100)}...`);
        console.log(`Author: ${tweet.author?.userName || 'unknown'}`);
        console.log(`Team ID: ${tweet.team_id}`);
        console.log(`Created: ${tweet.created_at}`);
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

checkTweets();
