require('dotenv').config();
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');
const Team = require('./models/Team');
const Match = require('./models/Match');
const { generateReportFor } = require('./controllers/reportController');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('🔗 Connected to database');
    
    // Check current tweet count
    const totalTweets = await Tweet.countDocuments();
    const saintsTweets = await Tweet.countDocuments({ team_id: 65 });
    
    console.log(`📊 Total tweets: ${totalTweets}`);
    console.log(`📊 Southampton tweets: ${saintsTweets}`);
    
    // Show recent tweets
    console.log('\n📝 Recent Southampton tweets:');
    const recentTweets = await Tweet.find({ team_id: 65 })
      .sort({ created_at: -1 })
      .limit(5);
      
    recentTweets.forEach((tweet, index) => {
      console.log(`${index + 1}. ${tweet.text?.substring(0, 80)}...`);
      console.log(`   ID: ${tweet.tweet_id}, Created: ${tweet.created_at}`);
      console.log(`   Analysis: ${JSON.stringify(tweet.analysis)}`);
      console.log('');
    });
    
    // Find a recent Southampton match to test reports
    console.log('🏈 Finding recent Southampton match...');
    const recentMatch = await Match.findOne({
      $or: [
        { home_team_id: 65 },
        { away_team_id: 65 }
      ]
    }).sort({ date: -1 });
    
    if (!recentMatch) {
      console.log('❌ No Southampton matches found');
      return;
    }
    
    console.log(`📍 Found match: ${recentMatch.home_team} vs ${recentMatch.away_team} (${recentMatch.date})`);
    console.log(`   Match ID: ${recentMatch.match_id}`);
    
    // Check if there are tweets in the time range around this match
    const matchDate = new Date(recentMatch.date);
    const beforeMatch = new Date(matchDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours before
    const afterMatch = new Date(matchDate.getTime() + 24 * 60 * 60 * 1000);  // 24 hours after
    
    const matchTweets = await Tweet.find({
      team_id: 65,
      created_at: { $gte: beforeMatch, $lte: afterMatch }
    });
    
    console.log(`🐦 Tweets around match time: ${matchTweets.length}`);
    
    if (matchTweets.length === 0) {
      console.log('⚠️ No tweets found around match time. Using all Southampton tweets for test.');
      
      // Let's temporarily modify a tweet's date to be around the match time
      const tweetToModify = await Tweet.findOne({ team_id: 65 });
      if (tweetToModify) {
        console.log(`🔄 Temporarily setting tweet ${tweetToModify.tweet_id} date to match time`);
        await Tweet.findByIdAndUpdate(tweetToModify._id, {
          created_at: new Date(matchDate.getTime() - 2 * 60 * 60 * 1000) // 2 hours before match
        });
      }
    }
    
    // Test report generation
    console.log('\n📋 Testing report generation...');
    try {
      const southampton = await Team.findOne({ id: 65 });
      const report = await generateReportFor(recentMatch, southampton);
      
      console.log('✅ Report generated successfully!');
      console.log(`📊 Report ID: ${report._id}`);
      console.log(`🐦 Embedded tweets: ${report.generated?.embedded_tweets?.length || 0}`);
      
      if (report.generated?.embedded_tweets?.length > 0) {
        console.log('\n🐦 Embedded tweets:');
        report.generated.embedded_tweets.forEach((tweet, index) => {
          console.log(`${index + 1}. ${tweet.text?.substring(0, 60)}...`);
          console.log(`   Engagement: ${tweet.engagement.likes} likes, ${tweet.engagement.retweets} retweets`);
        });
      } else {
        console.log('⚠️ No tweets were embedded in the report');
      }
      
    } catch (error) {
      console.error('❌ Error generating report:', error.message);
    }
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    mongoose.disconnect();
    console.log('\n✅ Disconnected from database');
  }
});