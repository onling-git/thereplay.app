// Check tweets for match 19432248
const mongoose = require('mongoose');
require('dotenv').config();

const Tweet = require('./models/Tweet');
const Match = require('./models/Match');
const Team = require('./models/Team');

async function checkTweets() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to MongoDB');
    
    const matchId = 19432248;
    
    // Get match details
    const match = await Match.findOne({ match_id: matchId }).lean();
    if (!match) {
      console.log(`❌ Match ${matchId} not found`);
      return;
    }
    
    console.log('\n=== MATCH DETAILS ===');
    console.log(`Match: ${match.home_team} vs ${match.away_team}`);
    console.log(`Date: ${match.date}`);
    console.log(`Status: ${match.match_status?.state}`);
    console.log(`Home Team ID: ${match.teams?.home?.team_id}`);
    console.log(`Away Team ID: ${match.teams?.away?.team_id}`);
    
    // Check home team Twitter config
    const homeTeam = await Team.findOne({ id: match.teams?.home?.team_id }).lean();
    console.log('\n=== HOME TEAM TWITTER CONFIG ===');
    console.log(`Team: ${homeTeam?.name}`);
    console.log(`Tweet Fetch Enabled: ${homeTeam?.twitter?.tweet_fetch_enabled}`);
    if (homeTeam?.twitter?.reporters) {
      console.log(`Reporters (${homeTeam.twitter.reporters.length}):`);
      homeTeam.twitter.reporters.forEach(r => {
        console.log(`  - ${r.handle} (priority: ${r.priority})`);
      });
    }
    
    // Check away team Twitter config
    const awayTeam = await Team.findOne({ id: match.teams?.away?.team_id }).lean();
    console.log('\n=== AWAY TEAM TWITTER CONFIG ===');
    console.log(`Team: ${awayTeam?.name}`);
    console.log(`Tweet Fetch Enabled: ${awayTeam?.twitter?.tweet_fetch_enabled}`);
    if (awayTeam?.twitter?.reporters) {
      console.log(`Reporters (${awayTeam.twitter.reporters.length}):`);
      awayTeam.twitter.reporters.forEach(r => {
        console.log(`  - ${r.handle} (priority: ${r.priority})`);
      });
    }
    
    // Check existing tweets
    const matchDate = new Date(match.date);
    const searchStart = new Date(matchDate.getTime() - 2 * 60 * 60 * 1000); // 2h before
    const searchEnd = new Date(matchDate.getTime() + 3 * 60 * 60 * 1000);   // 3h after
    
    const homeTeamId = match.teams?.home?.team_id;
    const awayTeamId = match.teams?.away?.team_id;
    
    const tweets = await Tweet.find({
      $or: [
        { match_id: matchId },
        {
          team_id: { $in: [homeTeamId, awayTeamId] },
          created_at: {
            $gte: searchStart,
            $lte: searchEnd
          }
        }
      ]
    }).lean();
    
    console.log('\n=== EXISTING TWEETS ===');
    console.log(`Total tweets: ${tweets.length}`);
    
    if (tweets.length > 0) {
      console.log('\nBreakdown:');
      const byTeam = {};
      const bySource = {};
      
      tweets.forEach(t => {
        byTeam[t.team_name || 'Unknown'] = (byTeam[t.team_name || 'Unknown'] || 0) + 1;
        const source = t.collection_context?.search_type || 'Unknown';
        bySource[source] = (bySource[source] || 0) + 1;
      });
      
      console.log('\nBy Team:');
      Object.entries(byTeam).forEach(([team, count]) => {
        console.log(`  ${team}: ${count}`);
      });
      
      console.log('\nBy Collection Source:');
      Object.entries(bySource).forEach(([source, count]) => {
        console.log(`  ${source}: ${count}`);
      });
      
      console.log('\nSample tweets:');
      tweets.slice(0, 3).forEach(t => {
        console.log(`\n  Tweet ${t.tweet_id}:`);
        console.log(`    Author: @${t.author.userName}`);
        console.log(`    Text: ${t.text.substring(0, 100)}...`);
        console.log(`    Team: ${t.team_name}`);
        console.log(`    Source: ${t.collection_context?.search_type}`);
        console.log(`    Created: ${t.created_at}`);
      });
    }
    
    // Check if TwitterAPI is configured
    console.log('\n=== TWITTER API CONFIG ===');
    console.log(`TWITTERAPI_KEY: ${process.env.TWITTERAPI_KEY ? '✅ Configured' : '❌ Not configured'}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkTweets();
