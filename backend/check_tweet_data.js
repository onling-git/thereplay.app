const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');
const Team = require('./models/Team');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    
    // Check total tweets
    const totalTweets = await Tweet.countDocuments();
    console.log(`\nTotal tweets in database: ${totalTweets}`);
    
    if (totalTweets > 0) {
      // Show recent tweets
      const recentTweets = await Tweet.find({}).limit(3).sort({ created_at: -1 });
      console.log('\n--- Recent tweets ---');
      recentTweets.forEach((tweet, index) => {
        console.log(`Tweet ${index + 1}:`);
        console.log(`  ID: ${tweet.tweet_id}`);
        console.log(`  Text: ${tweet.text?.substring(0, 100)}...`);
        console.log(`  Team: ${tweet.team_name} (${tweet.team_id})`);
        console.log(`  Date: ${tweet.created_at}`);
        console.log('');
      });
    }
    
    // Check teams with Twitter data
    const teamsWithTwitter = await Team.find({ 
      'twitter.tweet_fetch_enabled': true 
    }).limit(5);
    
    console.log(`\nTeams with Twitter enabled: ${teamsWithTwitter.length}`);
    teamsWithTwitter.forEach((team, index) => {
      console.log(`Team ${index + 1}: ${team.name} (${team.slug})`);
      console.log(`  Hashtag: ${team.twitter?.hashtag}`);
      console.log(`  Reporters: ${team.twitter?.reporters?.length || 0}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});