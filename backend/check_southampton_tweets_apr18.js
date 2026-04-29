// Check what Southampton tweets exist for April 18
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');

async function main() {
  await mongoose.connect(process.env.DBURI);
  console.log('✅ Connected to MongoDB\n');
  
  const matchDate = new Date('2026-04-18T14:00:00.000Z');
  const searchStart = new Date(matchDate.getTime() - 2 * 60 * 60 * 1000);
  const searchEnd = new Date(matchDate.getTime() + 3 * 60 * 60 * 1000);
  
  console.log('🔍 Searching for Southampton tweets on Apr 18...');
  console.log(`Time window: ${searchStart.toISOString()} to ${searchEnd.toISOString()}`);
  console.log('');
  
  // Check by team_id
  const teamIdTweets = await Tweet.find({
    team_id: 65, // Southampton
    created_at: {
      $gte: searchStart,
      $lte: searchEnd
    }
  }).sort({ created_at: 1 });
  
  console.log(`Found ${teamIdTweets.length} tweets for team_id 65 (Southampton)`);
  console.log('');
  
  if (teamIdTweets.length > 0) {
    teamIdTweets.forEach((tweet, i) => {
      console.log(`Tweet ${i + 1}:`);
      console.log(`  Author: @${tweet.author?.userName || 'unknown'}`);
      console.log(`  Text: ${tweet.text?.substring(0, 80)}...`);
      console.log(`  Created: ${tweet.created_at}`);
      console.log(`  Team ID: ${tweet.team_id}`);
      console.log(`  Team Slug: ${tweet.team_slug}`);
      console.log(`  Match ID: ${tweet.match_id || 'N/A'}`);
      console.log(`  Collection context:`);
      console.log(`    - search_type: ${tweet.collection_context?.search_type || 'N/A'}`);
      console.log(`    - collected_for: ${tweet.collection_context?.collected_for || 'N/A'}`);
      console.log(`    - source_priority: ${tweet.collection_context?.source_priority || 'N/A'}`);
      console.log('');
    });
  }
  
  // Also check by team slug
  const slugTweets = await Tweet.find({
    team_slug: 'southampton',
    created_at: {
      $gte: searchStart,
      $lte: searchEnd
    }
  }).sort({ created_at: 1 });
  
  console.log(`Found ${slugTweets.length} tweets for team_slug 'southampton'`);
  console.log('');
  
  // Check specifically for reporter tweets
  const reporterTweets = await Tweet.find({
    team_id: 65,
    created_at: {
      $gte: searchStart,
      $lte: searchEnd
    },
    'collection_context.search_type': 'reporter'
  });
  
  console.log(`Found ${reporterTweets.length} REPORTER tweets for Southampton`);
  
  if (reporterTweets.length > 0) {
    console.log('\nReporter tweets:');
    reporterTweets.forEach((tweet, i) => {
      console.log(`  ${i + 1}. @${tweet.author?.userName}: ${tweet.text?.substring(0, 60)}...`);
      console.log(`     Created: ${tweet.created_at}`);
    });
  }
  
  // Check for the specific Alfie House tweet
  const alfieTest = await Tweet.find({
    'author.userName': 'AlfieHouseEcho',
    text: /SWANSEA.*SAINTS/i
  }).sort({ created_at: -1 }).limit(5);
  
  console.log(`\n🔍 Looking for Alfie House tweet about Swansea vs Saints...`);
  console.log(`Found ${alfieTest.length} matching tweets`);
  
  if (alfieTest.length > 0) {
    alfieTest.forEach((tweet, i) => {
      console.log(`\nTweet ${i + 1}:`);
      console.log(`  Text: ${tweet.text}`);
      console.log(`  Created: ${tweet.created_at}`);
      console.log(`  Team ID: ${tweet.team_id}`);
      console.log(`  Match ID: ${tweet.match_id}`);
    });
  } else {
    console.log('❌ No matching tweet found - it may not have been collected yet');
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
