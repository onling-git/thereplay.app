// Script to configure Southampton (team_id: 65) for hashtag feed collection
// Run with: node configure_southampton_hashtag.js

const mongoose = require('mongoose');
require('dotenv').config();

const Team = require('./models/Team');

async function configureSouthamptomHashtagFeed() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    // Find Southampton by team ID
    const southampton = await Team.findOne({ id: 65 });
    
    if (!southampton) {
      console.error('❌ Southampton (team_id: 65) not found in database');
      process.exit(1);
    }

    console.log(`📍 Found team: ${southampton.name} (ID: ${southampton.id}, Slug: ${southampton.slug})`);

    // Configure hashtag feed
    southampton.twitter = southampton.twitter || {};
    southampton.twitter.hashtag_feed_enabled = true;
    southampton.twitter.feed_hashtag = '#SaintsFC'; // Southampton's primary fan hashtag
    southampton.twitter.hashtag = southampton.twitter.hashtag || '#SaintsFC'; // Set primary hashtag if not exists
    southampton.twitter.tweet_fetch_enabled = true;

    await southampton.save();

    console.log('✅ Southampton configured for hashtag feed:');
    console.log('   - hashtag_feed_enabled: true');
    console.log('   - feed_hashtag: #SaintsFC');
    console.log('   - Primary hashtag:', southampton.twitter.hashtag);
    console.log('\n📋 Next steps:');
    console.log('   1. The cron job will start collecting tweets every 2 hours');
    console.log('   2. Visit /southampton to see the Fan Reactions section');
    console.log('   3. First tweets should appear within 2 hours');
    console.log('\n💡 To manually trigger collection, run:');
    console.log('   POST /api/tweets/collect/team/southampton');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

configureSouthamptomHashtagFeed();
