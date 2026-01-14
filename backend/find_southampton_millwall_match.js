require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

const DBURI = process.env.DBURI;
mongoose.connect(DBURI);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    
    console.log('\n=== SEARCHING FOR SOUTHAMPTON VS MILLWALL MATCH ===');
    
    // Search for any matches involving Southampton and Millwall
    const southamptonMillwallMatches = await Match.find({
      $and: [
        {
          $or: [
            { 'teams.home.team_name': /southampton/i },
            { 'teams.away.team_name': /southampton/i },
            { home_team: /southampton/i },
            { away_team: /southampton/i }
          ]
        },
        {
          $or: [
            { 'teams.home.team_name': /millwall/i },
            { 'teams.away.team_name': /millwall/i },
            { home_team: /millwall/i },
            { away_team: /millwall/i }
          ]
        }
      ]
    }).sort({ 'match_info.starting_at': -1, date: -1 });
    
    if (southamptonMillwallMatches.length > 0) {
      console.log(`✅ Found ${southamptonMillwallMatches.length} Southampton vs Millwall match(es):`);
      
      southamptonMillwallMatches.forEach((match, i) => {
        console.log(`\n${i + 1}. Match ${match.match_id}:`);
        console.log('   Home team:', match.teams?.home?.team_name || match.home_team);
        console.log('   Away team:', match.teams?.away?.team_name || match.away_team);
        console.log('   Home team ID:', match.teams?.home?.team_id || match.home_team_id);
        console.log('   Away team ID:', match.teams?.away?.team_id || match.away_team_id);
        console.log('   Date:', match.match_info?.starting_at || match.date);
        console.log('   Status:', match.match_status || match.status);
        console.log('   Formation data?', match.lineup ? 'Yes' : 'No');
        if (match.lineup) {
          console.log('   Home lineup count:', match.lineup.home?.length || 0);
          console.log('   Away lineup count:', match.lineup.away?.length || 0);
        }
      });
    } else {
      console.log('❌ No Southampton vs Millwall matches found');
    }
    
    // Check if match 19432044 was originally Southampton vs Millwall
    console.log('\n=== CHECKING MATCH 19432044 CURRENT STATE ===');
    const match19432044 = await Match.findOne({ match_id: 19432044 });
    if (match19432044) {
      console.log('Current teams in match 19432044:');
      console.log('  Home:', match19432044.teams?.home?.team_name, `(ID: ${match19432044.teams?.home?.team_id})`);
      console.log('  Away:', match19432044.teams?.away?.team_name, `(ID: ${match19432044.teams?.away?.team_id})`);
      console.log('  Date:', match19432044.match_info?.starting_at || match19432044.date);
      console.log('  Status:', match19432044.match_status || match19432044.status);
    }
    
    // Search for all Southampton matches to see which one should be the "last match"
    console.log('\n=== ALL SOUTHAMPTON MATCHES (recent) ===');
    const allSouthamptonMatches = await Match.find({
      $or: [
        { 'teams.home.team_id': 65 },
        { 'teams.away.team_id': 65 },
        { 'teams.home.team_name': /southampton/i },
        { 'teams.away.team_name': /southampton/i }
      ]
    }).sort({ 'match_info.starting_at': -1, date: -1 }).limit(5);
    
    allSouthamptonMatches.forEach((match, i) => {
      console.log(`${i + 1}. Match ${match.match_id}:`);
      console.log(`   Teams: ${match.teams?.home?.team_name || match.home_team} vs ${match.teams?.away?.team_name || match.away_team}`);
      console.log(`   Date: ${match.match_info?.starting_at || match.date}`);
      console.log(`   Status: ${match.match_status?.state || match.match_status || match.status}`);
      console.log(`   Team IDs: ${match.teams?.home?.team_id || match.home_team_id} vs ${match.teams?.away?.team_id || match.away_team_id}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});