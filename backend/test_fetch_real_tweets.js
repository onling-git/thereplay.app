require('dotenv').config(); // Load environment variables first
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');
const Team = require('./models/Team');
const twitterService = require('./utils/twitterService');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('🔗 Connected to database');
    console.log(`🔑 Twitter API Key configured: ${!!process.env.TWITTERAPI_KEY}`);
    console.log(`🔑 Twitter API Key value: ${process.env.TWITTERAPI_KEY ? 'present' : 'missing'}`);
    
    // Reinitialize the Twitter service with the API key
    if (process.env.TWITTERAPI_KEY) {
      twitterService.apiKey = process.env.TWITTERAPI_KEY;
      console.log('🔄 Twitter service API key updated');
    }
    
    // Get Southampton team data (we know they have Twitter configured)
    const southampton = await Team.findOne({ slug: 'southampton' });
    if (!southampton) {
      console.log('❌ Southampton team not found');
      return;
    }
    
    console.log(`\n📊 Team: ${southampton.name} (${southampton.slug})`);
    console.log(`🐦 Twitter config:`, JSON.stringify(southampton.twitter, null, 2));
    
    // Test 1: Search by hashtag
    console.log('\n🔍 TEST 1: Searching tweets by hashtag...');
    try {
      const hashtagResults = await twitterService.searchByHashtag('#saintsfc', {
        queryType: 'Latest',
        lang: 'en'
      });
      
      console.log(`✅ Found ${hashtagResults.tweets.length} tweets by hashtag`);
      
      if (hashtagResults.tweets.length > 0) {
        const firstTweet = hashtagResults.tweets[0];
        console.log('\n📝 Sample tweet:');
        console.log(`ID: ${firstTweet.id}`);
        console.log(`Text: ${firstTweet.text?.substring(0, 100)}...`);
        console.log(`Author: @${firstTweet.author?.userName} (${firstTweet.author?.name})`);
        console.log(`Created: ${firstTweet.createdAt}`);
        console.log(`Engagement: ${(firstTweet.likeCount || 0)} likes, ${(firstTweet.retweetCount || 0)} retweets`);
      }
      
    } catch (error) {
      console.error('❌ Hashtag search failed:', error.message);
    }
    
    // Test 2: Search by team reporters
    console.log('\n🔍 TEST 2: Searching tweets by team reporters...');
    try {
      const reporterResults = await twitterService.searchTeamTweets(southampton, {
        queryType: 'Latest',
        lang: 'en'
      });
      
      console.log(`✅ Found ${reporterResults.tweets.length} tweets from team searches`);
      console.log(`📊 Successful searches: ${reporterResults.successfulSearches}/${reporterResults.totalSearches}`);
      
    } catch (error) {
      console.error('❌ Team search failed:', error.message);
    }
    
    // Test 3: Save a tweet to database
    console.log('\n💾 TEST 3: Saving tweets to database...');
    
    // Let's try the hashtag search again and save results
    try {
      const results = await twitterService.searchByHashtag('#saintsfc', {
        queryType: 'Latest',
        lang: 'en'
      });
      
      if (results.tweets.length === 0) {
        console.log('⚠️ No tweets found to save');
        return;
      }
      
      let saved = 0;
      let skipped = 0;
      
      for (const tweetData of results.tweets.slice(0, 5)) { // Save up to 5 tweets
        try {
          // Check if tweet already exists
          const existingTweet = await Tweet.findOne({ tweet_id: tweetData.id });
          if (existingTweet) {
            console.log(`⏭️ Tweet ${tweetData.id} already exists, skipping`);
            skipped++;
            continue;
          }
          
          // Transform and save tweet
          const { transformAndSaveTweet } = require('./controllers/tweetController');
          const savedTweet = await transformAndSaveTweet(tweetData, southampton);
          
          if (savedTweet) {
            console.log(`✅ Saved tweet ${savedTweet.tweet_id}`);
            console.log(`   Text: ${savedTweet.text?.substring(0, 80)}...`);
            saved++;
          }
          
        } catch (error) {
          console.error(`❌ Error saving tweet ${tweetData.id}:`, error.message);
        }
      }
      
      console.log(`\n📊 Summary: ${saved} tweets saved, ${skipped} skipped`);
      
      // Check total tweets in database now
      const totalTweets = await Tweet.countDocuments();
      console.log(`📈 Total tweets in database: ${totalTweets}`);
      
    } catch (error) {
      console.error('❌ Error in save test:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
});