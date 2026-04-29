// Script to configure Portsmouth for hashtag feed collection
// Run with: node configure_portsmouth_hashtag.js

const mongoose = require('mongoose');
require('dotenv').config();

const Team = require('./models/Team');

async function configurePortsmouthHashtagFeed() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    // Find Portsmouth by name (you can also search by slug or id if you know it)
    const portsmouth = await Team.findOne({ 
      $or: [
        { name: /portsmouth/i },
        { slug: 'portsmouth' }
      ]
    });
    
    if (!portsmouth) {
      console.error('❌ Portsmouth not found in database');
      console.log('\n💡 Searching for teams with "port" in the name...');
      const similarTeams = await Team.find({ 
        name: /port/i 
      }).select('id name slug').limit(5);
      if (similarTeams.length > 0) {
        console.log('Found these teams:');
        similarTeams.forEach(t => console.log(`  - ${t.name} (ID: ${t.id}, Slug: ${t.slug})`));
      }
      process.exit(1);
    }

    console.log(`📍 Found team: ${portsmouth.name} (ID: ${portsmouth.id}, Slug: ${portsmouth.slug})`);
    console.log(`\n📋 Current Twitter settings:`);
    console.log(`   - hashtag: ${portsmouth.twitter?.hashtag || 'NOT SET'}`);
    console.log(`   - feed_hashtag: ${portsmouth.twitter?.feed_hashtag || 'NOT SET'}`);
    console.log(`   - hashtag_feed_enabled: ${portsmouth.twitter?.hashtag_feed_enabled || false}`);
    console.log(`   - tweet_fetch_enabled: ${portsmouth.twitter?.tweet_fetch_enabled || false}`);

    // Configure hashtag feed
    portsmouth.twitter = portsmouth.twitter || {};
    portsmouth.twitter.hashtag_feed_enabled = true;
    portsmouth.twitter.feed_hashtag = '#pompey'; // Portsmouth's fan hashtag
    portsmouth.twitter.hashtag = portsmouth.twitter.hashtag || '#pompey'; // Set primary hashtag if not exists
    portsmouth.twitter.tweet_fetch_enabled = true;

    await portsmouth.save();

    console.log('\n✅ Portsmouth configured for hashtag feed:');
    console.log('   - hashtag_feed_enabled: true ✓');
    console.log('   - feed_hashtag: #pompey ✓');
    console.log('   - Primary hashtag:', portsmouth.twitter.hashtag);
    console.log('   - tweet_fetch_enabled: true ✓');
    console.log('\n📋 Next steps:');
    console.log('   1. The cron job will start collecting tweets every 2 hours');
    console.log(`   2. Visit /${portsmouth.slug} to see the Fan Reactions section`);
    console.log('   3. First tweets should appear within 2 hours');
    console.log('\n💡 To manually trigger collection immediately, run:');
    console.log(`   POST /api/tweets/collect/team/${portsmouth.slug}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

configurePortsmouthHashtagFeed();
