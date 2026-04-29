// Search for the specific Alfie House full-time tweet
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');

async function main() {
  await mongoose.connect(process.env.DBURI);
  console.log('✅ Connected to MongoDB\n');
  
  // Search for Alfie House tweets on April 18
  const alfie = await Tweet.find({
    'author.userName': 'AlfieHouseEcho',
    created_at: {
      $gte: new Date('2026-04-18T00:00:00.000Z'),
      $lt: new Date('2026-04-19T00:00:00.000Z')
    }
  }).sort({ created_at: 1 });
  
  console.log(`Found ${alfie.length} tweets from @AlfieHouseEcho on April 18:\n`);
  
  alfie.forEach((tweet, i) => {
    const utc = new Date(tweet.created_at).toISOString();
    const local = new Date(tweet.created_at).toLocaleString('en-GB', { 
      timeZone: 'Europe/Paris',
      hour12: false
    });
    
    console.log(`${i + 1}. ${local} (${utc})`);
    console.log(`   ${tweet.text?.substring(0, 100)}`);
    console.log(`   match_id: ${tweet.match_id || 'N/A'}`);
    console.log(`   search_type: ${tweet.collection_context?.search_type || 'N/A'}`);
    console.log('');
  });
  
  // Search specifically for "FULL-TIME" or "SWANSEA" text
  const fullTime = await Tweet.find({
    'author.userName': 'AlfieHouseEcho',
    text: /FULL-TIME|SWANSEA.*SAINTS/i,
    created_at: {
      $gte: new Date('2026-04-18T00:00:00.000Z'),
      $lt: new Date('2026-04-19T00:00:00.000Z')
    }
  });
  
  console.log('='.repeat(80));
  console.log(`\nSearching for "FULL-TIME" or "SWANSEA...SAINTS" tweets from Alfie:`);
  console.log(`Found: ${fullTime.length} matching tweets\n`);
  
  fullTime.forEach((tweet, i) => {
    console.log(`${i + 1}. ${tweet.created_at.toISOString()}`);
    console.log(`   ${tweet.text}`);
    console.log(`   match_id: ${tweet.match_id || 'N/A'}`);
    console.log('');
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
