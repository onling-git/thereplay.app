// Check for reporter tweets and match-specific tweets
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');

async function main() {
  await mongoose.connect(process.env.DBURI);
  console.log('✅ Connected to MongoDB\n');
  
  // Check for match 19432260
  console.log('🔍 Checking for match 19432260 tweets...\n');
  
  const matchTweets = await Tweet.find({
    match_id: 19432260
  });
  
  console.log(`Found ${matchTweets.length} tweets with match_id 19432260`);
  
  if (matchTweets.length > 0) {
    matchTweets.forEach((tweet, i) => {
      console.log(`\nTweet ${i + 1}:`);
      console.log(`  Author: @${tweet.author?.userName}`);
      console.log(`  Text: ${tweet.text?.substring(0, 80)}`);
      console.log(`  Created: ${tweet.created_at}`);
      console.log(`  Team ID: ${tweet.team_id}`);
      console.log(`  Match ID: ${tweet.match_id}`);
      console.log(`  search_type: ${tweet.collection_context?.search_type}`);
      console.log(`  collected_for: ${tweet.collection_context?.collected_for}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🔍 Checking for reporter tweets for Southampton...\n');
  
  const reporterTweets = await Tweet.find({
    team_id: 65,
    'collection_context.search_type': 'reporter'
  }).sort({ created_at: -1 }).limit(20);
  
  console.log(`Found ${reporterTweets.length} total reporter tweets for Southampton`);
  
  if (reporterTweets.length > 0) {
    console.log('\nMost recent reporter tweets:');
    reporterTweets.forEach((tweet, i) => {
      console.log(`\n${i + 1}. @${tweet.author?.userName} (${tweet.created_at})`);
      console.log(`   ${tweet.text?.substring(0, 100)}`);
      console.log(`   match_id: ${tweet.match_id || 'N/A'}`);
      console.log(`   collected_for: ${tweet.collection_context?.collected_for}`);
    });
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🔍 Checking all April 18 tweets by collection type...\n');
  
  const april18 = await Tweet.aggregate([
    {
      $match: {
        team_id: 65,
        created_at: {
          $gte: new Date('2026-04-18T00:00:00.000Z'),
          $lt: new Date('2026-04-19T00:00:00.000Z')
        }
      }
    },
    {
      $group: {
        _id: {
          search_type: '$collection_context.search_type',
          collected_for: '$collection_context.collected_for'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);
  
  console.log('April 18 tweets by type:');
  april18.forEach(group => {
    console.log(`  - search_type: ${group._id.search_type || 'N/A'}, collected_for: ${group._id.collected_for || 'N/A'}: ${group.count} tweets`);
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
