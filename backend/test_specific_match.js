const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');
const Team = require('./models/Team');
const Match = require('./models/Match');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    
    // Find the specific match
    const match = await Match.findOne({ match_id: 19431921 });
    
    if (!match) {
      console.log('Match 19431921 not found');
      mongoose.disconnect();
      return;
    }
    
    console.log(`\nFound match: ${match.match_id}`);
    console.log(`Date: ${match.date}`);
    console.log(`Home: ${match.home_team} (ID: ${match.home_team_id})`);
    console.log(`Away: ${match.away_team} (ID: ${match.away_team_id})`);
    console.log(`Status: ${match.status_short}`);
    
    // Test with home team
    const homeTeam = await Team.findOne({ id: match.home_team_id });
    const awayTeam = await Team.findOne({ id: match.away_team_id });
    
    console.log(`\nHome team: ${homeTeam?.name} (${homeTeam?.slug})`);
    console.log(`Away team: ${awayTeam?.name} (${awayTeam?.slug})`);
    
    // Check if either team has Twitter data
    if (homeTeam?.twitter?.tweet_fetch_enabled) {
      console.log(`\n--- Testing tweet methods for ${homeTeam.name} ---`);
      await testTweetMethods(homeTeam, match);
    } else if (awayTeam?.twitter?.tweet_fetch_enabled) {
      console.log(`\n--- Testing tweet methods for ${awayTeam.name} ---`);
      await testTweetMethods(awayTeam, match);
    } else {
      console.log('\nNeither team has Twitter enabled. Let\'s test with Southampton (ID: 65)');
      const southampton = await Team.findOne({ id: 65 });
      if (southampton) {
        await testTweetMethods(southampton, match);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});

async function testTweetMethods(team, match) {
  console.log(`\nTeam: ${team.name} (ID: ${team.id})`);
  console.log(`Twitter enabled: ${team.twitter?.tweet_fetch_enabled}`);
  
  // Test the Tweet methods used in report generation
  console.log('\n--- Testing Tweet.findForReport ---');
  const reportTweets = await Tweet.findForReport(team.id, match.date, {
    preMatchHours: 24,
    postMatchHours: 6,
    limit: 20
  });
  
  console.log(`Found ${reportTweets.length} tweets using findForReport`);
  
  // Test findByTeamAndDateRange
  console.log('\n--- Testing Tweet.findByTeamAndDateRange ---');
  const rangeStart = new Date(match.date.getTime() - 48 * 60 * 60 * 1000);
  const rangeEnd = new Date(match.date.getTime() + 12 * 60 * 60 * 1000);
  
  const rangeTweets = await Tweet.findByTeamAndDateRange(team.id, rangeStart, rangeEnd, {
    limit: 15,
    matchRelated: false
  });
  
  console.log(`Found ${rangeTweets.length} tweets using findByTeamAndDateRange`);
  
  // Show all tweets for this team
  const allTweets = await Tweet.find({ team_id: team.id }).sort({ created_at: -1 });
  console.log(`\nTotal tweets for ${team.name}: ${allTweets.length}`);
  
  if (allTweets.length > 0) {
    console.log('\nSample tweets:');
    allTweets.slice(0, 3).forEach((tweet, index) => {
      console.log(`  Tweet ${index + 1}:`);
      console.log(`    Date: ${tweet.created_at}`);
      console.log(`    Status: ${tweet.status}`);
      console.log(`    Match related: ${tweet.analysis?.is_match_related}`);
      console.log(`    Engagement: ${tweet.likeCount || 0} likes, ${tweet.retweetCount || 0} retweets`);
      console.log(`    Text: ${tweet.text.substring(0, 100)}...`);
      console.log('');
    });
    
    // Check if any tweets match the time range
    const matchTime = match.date;
    const matchStart = new Date(matchTime.getTime() - 24 * 60 * 60 * 1000);
    const matchEnd = new Date(matchTime.getTime() + 6 * 60 * 60 * 1000);
    
    console.log(`\nMatch time range: ${matchStart} to ${matchEnd}`);
    
    const tweetsInRange = allTweets.filter(tweet => 
      tweet.created_at >= matchStart && tweet.created_at <= matchEnd
    );
    
    console.log(`Tweets in match time range: ${tweetsInRange.length}`);
    
    // Check tweet status filtering
    const processedTweets = allTweets.filter(tweet => 
      tweet.status === 'processed' || tweet.status === 'verified'
    );
    
    console.log(`Tweets with processed/verified status: ${processedTweets.length}`);
    
    if (processedTweets.length === 0) {
      console.log('⚠️  ISSUE FOUND: No tweets have processed/verified status!');
      console.log('Available statuses:');
      const statuses = [...new Set(allTweets.map(t => t.status))];
      statuses.forEach(status => {
        const count = allTweets.filter(t => t.status === status).length;
        console.log(`  ${status}: ${count} tweets`);
      });
    }
  }
}