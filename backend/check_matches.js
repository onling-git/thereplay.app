const mongoose = require('mongoose');
const Match = require('./models/Match');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    
    // Find all Southampton matches (recent)
    const southamptonMatches = await Match.find({
      $or: [
        { home_team_id: 65 },
        { away_team_id: 65 }
      ]
    }).sort({ date: -1 }).limit(5);
    
    console.log(`Found ${southamptonMatches.length} Southampton matches:`);
    
    southamptonMatches.forEach((match, index) => {
      console.log(`\nMatch ${index + 1}:`);
      console.log(`  ID: ${match.match_id}`);
      console.log(`  Date: ${match.date}`);
      console.log(`  Home: ${match.home_team} (${match.home_team_id})`);
      console.log(`  Away: ${match.away_team} (${match.away_team_id})`);
      console.log(`  Status: ${match.status_short}`);
    });
    
    // Also check for any recent matches at all
    console.log('\n--- Recent matches (any team) ---');
    const recentMatches = await Match.find({}).sort({ date: -1 }).limit(3);
    
    recentMatches.forEach((match, index) => {
      console.log(`\nRecent match ${index + 1}:`);
      console.log(`  ID: ${match.match_id}`);
      console.log(`  Date: ${match.date}`);
      console.log(`  Home: ${match.home_team} (${match.home_team_id})`);
      console.log(`  Away: ${match.away_team} (${match.away_team_id})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});