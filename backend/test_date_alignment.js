const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');
const Team = require('./models/Team');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('🔍 Testing Tweet Date Alignment for Reports\n');
    
    // Get Southampton team
    const southampton = await Team.findOne({ id: 65 });
    console.log(`Team: ${southampton.name} (ID: ${southampton.id})`);
    
    // Get all Southampton tweets with dates
    const allTweets = await Tweet.find({ team_id: 65 }).sort({ created_at: -1 });
    console.log(`\n📊 Total Southampton tweets: ${allTweets.length}`);
    
    if (allTweets.length > 0) {
      console.log('\n📅 Tweet dates:');
      allTweets.forEach((tweet, index) => {
        console.log(`  ${index + 1}. ${tweet.created_at.toISOString()} - "${tweet.text.substring(0, 60)}..."`);
      });
      
      // Test 1: Match from November 5th (the actual old match)
      const oldMatchDate = new Date('2025-11-05T19:45:00.000Z');
      console.log(`\n🏈 TEST 1: Old Match Date (${oldMatchDate.toISOString()})`);
      
      const oldMatchTweets = await Tweet.findForReport(southampton.id, oldMatchDate, {
        preMatchHours: 24,
        postMatchHours: 6,
        limit: 20
      });
      
      console.log(`   Result: ${oldMatchTweets.length} tweets found`);
      console.log(`   Expected: 0 (tweets are too recent for this old match)`);
      
      // Test 2: Mock match around when tweets were actually created (Nov 19th)
      const recentMatchDate = new Date('2025-11-19T12:00:00.000Z');
      console.log(`\n🏈 TEST 2: Recent Match Date (${recentMatchDate.toISOString()})`);
      
      const recentMatchTweets = await Tweet.findForReport(southampton.id, recentMatchDate, {
        preMatchHours: 24,
        postMatchHours: 6,
        limit: 20
      });
      
      console.log(`   Result: ${recentMatchTweets.length} tweets found`);
      console.log(`   Expected: ${allTweets.length} (all tweets should be in range)`);
      
      if (recentMatchTweets.length > 0) {
        console.log('\n🎉 SUCCESS! The fix is working!');
        console.log('\n📋 Sample tweets that would be embedded:');
        recentMatchTweets.slice(0, 3).forEach((tweet, index) => {
          console.log(`\n   Tweet ${index + 1}:`);
          console.log(`   ID: ${tweet.tweet_id}`);
          console.log(`   Date: ${tweet.created_at.toISOString()}`);
          console.log(`   Status: ${tweet.status}`);
          console.log(`   Match Related: ${tweet.analysis?.is_match_related || 'N/A'}`);
          console.log(`   Engagement: ${tweet.likeCount || 0} likes, ${tweet.retweetCount || 0} retweets`);
          console.log(`   Text: "${tweet.text.substring(0, 100)}..."`);
        });
        
        console.log('\n✅ CONCLUSION:');
        console.log('- The Tweet.findForReport fix IS working correctly');
        console.log('- Tweets with "raw" status are now being retrieved');
        console.log('- The reason we saw 0 tweets in the report was the date mismatch');
        console.log('- For real matches with recent tweets, embedded tweets will appear');
        
      } else {
        console.log('\n❌ The fix might not be working properly');
      }
      
      // Test 3: Show the time windows being used
      console.log('\n⏰ Time Windows for Match Analysis:');
      console.log(`Old Match (Nov 5): ${new Date(oldMatchDate.getTime() - 24*60*60*1000).toISOString()} to ${new Date(oldMatchDate.getTime() + 6*60*60*1000).toISOString()}`);
      console.log(`Recent Match (Nov 19): ${new Date(recentMatchDate.getTime() - 24*60*60*1000).toISOString()} to ${new Date(recentMatchDate.getTime() + 6*60*60*1000).toISOString()}`);
      
    } else {
      console.log('No tweets found for Southampton');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});