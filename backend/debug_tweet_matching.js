// Debug tweet matching for match 19432248
const mongoose = require('mongoose');
require('dotenv').config();

const Tweet = require('./models/Tweet');
const Match = require('./models/Match');

async function debugTweets() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to MongoDB');
    
    const matchId = 19432248;
    
    // Get match
    const match = await Match.findOne({ match_id: matchId }).lean();
    const homeTeamId = match.teams?.home?.team_id;
    
    // Get home team tweets
    const matchDate = new Date(match.date);
    const searchStart = new Date(matchDate.getTime() - 2 * 60 * 60 * 1000);
    const searchEnd = new Date(matchDate.getTime() + 3 * 60 * 60 * 1000);
    
    const tweets = await Tweet.find({
      team_id: homeTeamId,
      created_at: { $gte: searchStart, $lte: searchEnd }
    }).sort({ created_at: 1 }).lean();
    
    console.log(`\n=== HOME TEAM TWEETS (${tweets.length}) ===\n`);
    
    tweets.forEach((t, i) => {
      console.log(`Tweet ${i + 1}:`);
      console.log(`  ID: ${t.tweet_id}`);
      console.log(`  Author: @${t.author.userName}`);
      console.log(`  Text length: ${t.text.length}`);
      console.log(`  First 50 chars: "${t.text.substring(0, 50)}"`);
      console.log(`  Full text: "${t.text}"`);
      console.log(`  Created: ${t.created_at}`);
      console.log('');
    });
    
    // Show what we're trying to match
    const searchText = "GOOAAAALLLL SCIENZAAAAA!!!! 1-1";
    console.log('\n=== TRYING TO MATCH ===');
    console.log(`Search text: "${searchText}"`);
    console.log(`Search length: ${searchText.length}`);
    
    // Try different matching approaches
    const exactMatch = tweets.find(t => t.text === searchText);
    console.log(`Exact match: ${exactMatch ? 'FOUND' : 'NOT FOUND'}`);
    
    const startsWithMatch = tweets.find(t => t.text.startsWith(searchText.substring(0, 30)));
    console.log(`Starts-with (30 chars): ${startsWithMatch ? 'FOUND' : 'NOT FOUND'}`);
    if (startsWithMatch) {
      console.log(`  Matched: "${startsWithMatch.text.substring(0, 50)}"`);
    }
    
    const includesMatch = tweets.find(t => t.text.includes("GOOAAAALLLL"));
    console.log(`Includes "GOOAAAALLLL": ${includesMatch ? 'FOUND' : 'NOT FOUND'}`);
    if (includesMatch) {
      console.log(`  Matched: "${includesMatch.text.substring(0, 80)}"`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

debugTweets();
