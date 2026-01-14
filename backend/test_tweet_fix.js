const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');
const Tweet = require('./models/Tweet');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    
    // Find recent Southampton matches since we have tweets for them
    const southamptonMatches = await Match.find({
      $or: [
        { home_team_id: 65 },
        { away_team_id: 65 }
      ],
      date: { $gte: new Date('2025-11-10') } // Recent matches
    }).sort({ date: -1 }).limit(5);
    
    console.log(`Found ${southamptonMatches.length} recent Southampton matches:`);
    
    if (southamptonMatches.length === 0) {
      console.log('No recent Southampton matches found. Let\'s create a mock test:');
      
      // Test with current date to simulate tweets around a match
      const mockMatchDate = new Date('2025-11-19T15:00:00Z'); // Around when the tweets were created
      const southampton = await Team.findOne({ id: 65 });
      
      console.log(`\nTesting with mock match date: ${mockMatchDate}`);
      console.log(`Team: ${southampton.name} (ID: ${southampton.id})`);
      
      // Test the fixed findForReport method
      const reportTweets = await Tweet.findForReport(southampton.id, mockMatchDate, {
        preMatchHours: 24,
        postMatchHours: 6,
        limit: 20
      });
      
      console.log(`\n✅ Found ${reportTweets.length} tweets using findForReport (with fix)`);
      
      if (reportTweets.length > 0) {
        console.log('\nTweets found:');
        reportTweets.forEach((tweet, index) => {
          console.log(`  Tweet ${index + 1}:`);
          console.log(`    ID: ${tweet.tweet_id}`);
          console.log(`    Date: ${tweet.created_at}`);
          console.log(`    Status: ${tweet.status}`);
          console.log(`    Match related: ${tweet.analysis?.is_match_related}`);
          console.log(`    Engagement: ${tweet.likeCount || 0} likes, ${tweet.retweetCount || 0} retweets`);
          console.log(`    Text: ${tweet.text.substring(0, 80)}...`);
          console.log('');
        });
        
        console.log('🎉 SUCCESS: Tweets are now being retrieved for reports!');
        
        // Test if they would be formatted correctly for embedding
        console.log('\n--- Testing tweet embedding format ---');
        const sampleTweet = reportTweets[0];
        const embeddedFormat = {
          tweet_id: sampleTweet.tweet_id,
          text: sampleTweet.text,
          author: {
            name: sampleTweet.author?.name || sampleTweet.author?.userName,
            userName: sampleTweet.author?.userName,
            profilePicture: sampleTweet.author?.profilePicture,
            isBlueVerified: sampleTweet.author?.isBlueVerified || false
          },
          created_at: sampleTweet.created_at,
          engagement: {
            likes: sampleTweet.likeCount || 0,
            retweets: sampleTweet.retweetCount || 0,
            replies: sampleTweet.replyCount || 0
          },
          url: sampleTweet.url || `https://twitter.com/i/status/${sampleTweet.tweet_id}`,
          embed_context: sampleTweet.analysis?.sentiment === 'positive' ? 'fan_reaction' : 'social_commentary',
          placement_hint: 'after_summary'
        };
        
        console.log('Sample embedded tweet format:');
        console.log(JSON.stringify(embeddedFormat, null, 2));
      }
      
    } else {
      southamptonMatches.forEach((match, index) => {
        console.log(`\nMatch ${index + 1}:`);
        console.log(`  ID: ${match.match_id}`);
        console.log(`  Date: ${match.date}`);
        console.log(`  Home: ${match.home_team} (${match.home_team_id})`);
        console.log(`  Away: ${match.away_team} (${match.away_team_id})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});