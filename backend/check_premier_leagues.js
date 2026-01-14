const { MongoClient } = require('mongodb');

async function checkPremierLeagues() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
  const client = new MongoClient(uri);
  
  try {
    await client.connect();
    const db = client.db();
    
    console.log('Checking Premier League IDs in matches collection...\n');
    
    // Check matches for Premier League IDs
    const premierLeagueIds = [8, 486, 609];
    
    for (const leagueId of premierLeagueIds) {
      const matches = await db.collection('matches').find({ league_id: leagueId }).limit(5).toArray();
      const count = await db.collection('matches').countDocuments({ league_id: leagueId });
      
      console.log(`League ID ${leagueId}:`);
      console.log(`  Total matches: ${count}`);
      
      if (matches.length > 0) {
        const firstMatch = matches[0];
        console.log(`  League name: "${firstMatch.league_name}"`);
        console.log(`  Season: ${firstMatch.season_id || 'N/A'}`);
        console.log(`  Sample match: ${firstMatch.home_team?.name || 'N/A'} vs ${firstMatch.away_team?.name || 'N/A'}`);
        console.log(`  Match date: ${firstMatch.starting_at ? new Date(firstMatch.starting_at).toDateString() : 'N/A'}`);
      } else {
        console.log('  No matches found');
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await client.close();
  }
}

checkPremierLeagues();