// Quick script to manually collect Southampton hashtag feed tweets
const mongoose = require('mongoose');
require('dotenv').config();

const Team = require('./models/Team');
const Tweet = require('./models/Tweet');
const twitterService = require('./utils/twitterService');

async function collectSouthamptonFeed() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    const team = await Team.findOne({ slug: 'southampton' });
    if (!team) {
      console.error('❌ Southampton not found');
      process.exit(1);
    }

    console.log(`📍 Found: ${team.name} (ID: ${team.id})`);
    console.log(`📱 Feed hashtag: ${team.twitter?.feed_hashtag || team.twitter?.hashtag}`);

    const hashtag = team.twitter?.feed_hashtag || team.twitter?.hashtag;
    if (!hashtag) {
      console.error('❌ No hashtag configured');
      process.exit(1);
    }

    console.log(`\n🐦 Searching for tweets with ${hashtag}...`);

    const searchOptions = {
      queryType: 'Latest',
      since: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      lang: 'en'
    };

    const results = await twitterService.searchByHashtag(hashtag, searchOptions);
    console.log(`✅ Found ${results.tweets.length} tweets`);

    let saved = 0;
    let skipped = 0;

    for (const tweetData of results.tweets.slice(0, 20)) {
      try {
        const existingTweet = await Tweet.findOne({ tweet_id: tweetData.id });
        if (existingTweet) {
          skipped++;
          continue;
        }

        const tweetDoc = new Tweet({
          tweet_id: tweetData.id,
          text: tweetData.text,
          url: tweetData.url || `https://twitter.com/i/web/status/${tweetData.id}`,
          author: tweetData.author ? {
            id: tweetData.author.id,
            userName: tweetData.author.userName,
            name: tweetData.author.name,
            profilePicture: tweetData.author.profilePicture,
            isBlueVerified: tweetData.author.isBlueVerified,
            verifiedType: tweetData.author.verifiedType
          } : undefined,
          created_at: new Date(tweetData.createdAt),
          fetched_at: new Date(),
          retweetCount: tweetData.retweetCount || 0,
          replyCount: tweetData.replyCount || 0,
          likeCount: tweetData.likeCount || 0,
          quoteCount: tweetData.quoteCount || 0,
          viewCount: tweetData.viewCount || 0,
          bookmarkCount: tweetData.bookmarkCount || 0,
          lang: tweetData.lang,
          isReply: tweetData.isReply || false,
          team_id: team.id,
          team_slug: team.slug,
          team_name: team.name,
          collection_context: {
            search_query: hashtag,
            search_type: 'hashtag',
            collected_for: 'team_feed',
            source_priority: 5
          },
          status: 'raw'
        });

        await tweetDoc.save();
        saved++;
        console.log(`  ✓ Saved tweet from @${tweetData.author?.userName}`);

      } catch (error) {
        console.error(`  ✗ Error saving tweet:`, error.message);
      }
    }

    await Team.findOneAndUpdate(
      { id: team.id },
      { 'twitter.last_feed_fetch': new Date() }
    );

    console.log(`\n✅ Complete: ${saved} saved, ${skipped} skipped`);
    console.log(`\n🌐 Visit https://thereplay.app/southampton to see the tweets!`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
}

collectSouthamptonFeed();
