const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');
const Team = require('./models/Team');
const Match = require('./models/Match');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    
    // Find Southampton team and a recent match
    const southampton = await Team.findOne({ id: 65 });
    console.log(`Southampton team: ${southampton?.name} (ID: ${southampton?.id})`);
    
    // Find a recent match for Southampton
    const recentMatch = await Match.findOne({
      $or: [
        { home_team_id: 65 },
        { away_team_id: 65 }
      ]
    }).sort({ date: -1 });
    
    if (recentMatch) {
      console.log(`\nRecent match: ${recentMatch.match_id}`);
      console.log(`Date: ${recentMatch.date}`);
      console.log(`Home: ${recentMatch.home_team} vs Away: ${recentMatch.away_team}`);
      
      // Test the Tweet methods used in report generation
      console.log('\n--- Testing Tweet.findForReport ---');
      const reportTweets = await Tweet.findForReport(southampton.id, recentMatch.date, {
        preMatchHours: 24,
        postMatchHours: 6,
        limit: 20
      });
      
      console.log(`Found ${reportTweets.length} tweets using findForReport`);
      
      // Test findByTeamAndDateRange
      console.log('\n--- Testing Tweet.findByTeamAndDateRange ---');
      const rangeStart = new Date(recentMatch.date.getTime() - 48 * 60 * 60 * 1000);
      const rangeEnd = new Date(recentMatch.date.getTime() + 12 * 60 * 60 * 1000);
      
      const rangeTweets = await Tweet.findByTeamAndDateRange(southampton.id, rangeStart, rangeEnd, {
        limit: 15,
        matchRelated: false
      });
      
      console.log(`Found ${rangeTweets.length} tweets using findByTeamAndDateRange`);
      
      // Show available tweets for this team
      console.log('\n--- All Southampton tweets ---');
      const allTweets = await Tweet.find({ team_id: 65 }).sort({ created_at: -1 });
      
      console.log(`Total Southampton tweets: ${allTweets.length}`);
      allTweets.forEach((tweet, index) => {
        console.log(`Tweet ${index + 1}:`);
        console.log(`  Date: ${tweet.created_at}`);
        console.log(`  Match date: ${recentMatch.date}`);
        console.log(`  Status: ${tweet.status}`);
        console.log(`  Match related: ${tweet.analysis?.is_match_related}`);
        console.log(`  Text: ${tweet.text.substring(0, 80)}...`);
        console.log('');
      });
      
    } else {
      console.log('No recent matches found for Southampton');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});