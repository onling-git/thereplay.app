// Check reporters and hashtags configured for Southampton and Leicester
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Team = require('./models/Team');

async function main() {
  await mongoose.connect(process.env.DBURI);
  console.log('✅ Connected to MongoDB\n');
  
  const teams = await Team.find({
    slug: { $in: ['southampton', 'leicester-city'] }
  }).lean();
  
  for (const team of teams) {
    console.log('='.repeat(80));
    console.log(`Team: ${team.name} (${team.slug})`);
    console.log(`ID: ${team.id}`);
    console.log('='.repeat(80));
    
    console.log('\n📰 REPORTERS (for match reports):');
    if (team.twitter?.reporters && team.twitter.reporters.length > 0) {
      team.twitter.reporters.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.name} - ${r.handle}`);
      });
    } else {
      console.log('  ❌ No reporters configured');
    }
    
    console.log('\n#️⃣ PRIMARY HASHTAG (for match reports):');
    console.log(`  ${team.twitter?.hashtag || '❌ Not set'}`);
    
    console.log('\n#️⃣ ALTERNATIVE HASHTAGS (for match reports):');
    if (team.twitter?.alternative_hashtags && team.twitter.alternative_hashtags.length > 0) {
      team.twitter.alternative_hashtags.forEach((h, i) => {
        console.log(`  ${i + 1}. ${h}`);
      });
    } else {
      console.log('  ❌ No alternative hashtags configured');
    }
    
    console.log('\n📱 FAN FEED HASHTAG (for public Twitter feed):');
    console.log(`  ${team.twitter?.feed_hashtag || '❌ Not set'}`);
    console.log(`  Enabled: ${team.twitter?.hashtag_feed_enabled ? '✅ Yes' : '❌ No'}`);
    
    console.log('\n⚙️ TWEET FETCH STATUS:');
    console.log(`  Enabled: ${team.twitter?.tweet_fetch_enabled ? '✅ Yes' : '❌ No'}`);
    
    console.log('\n');
  }
  
  await mongoose.disconnect();
}

main().catch(console.error);
