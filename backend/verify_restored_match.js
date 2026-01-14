require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

const DBURI = process.env.DBURI;
mongoose.connect(DBURI);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    console.log('🔍 Verifying restored Southampton vs Millwall match...\n');

    // Check the specific match
    const match19432044 = await Match.findOne({ match_id: 19432044 });
    
    console.log('=== MATCH 19432044 VERIFICATION ===');
    console.log('Match ID:', match19432044.match_id);
    console.log('Home team:', match19432044.teams?.home?.team_name, `(ID: ${match19432044.teams?.home?.team_id})`);
    console.log('Away team:', match19432044.teams?.away?.team_name, `(ID: ${match19432044.teams?.away?.team_id})`);
    console.log('Date:', match19432044.match_info?.starting_at || match19432044.date);
    console.log('Score:', `${match19432044.score?.home}-${match19432044.score?.away}`);
    console.log('Status:', match19432044.match_status);
    
    // Test Southampton "last match" logic
    console.log('\n=== SOUTHAMPTON LAST MATCH LOGIC TEST ===');
    const now = new Date();
    console.log('Current time:', now.toISOString());
    
    const lastFinishedMatch = await Match.findOne({
      $and: [
        {
          $or: [
            { 'teams.home.team_id': 65 }, // Southampton team ID
            { 'teams.away.team_id': 65 }
          ]
        },
        {
          $or: [
            { 'match_info.starting_at': { $lte: now } },
            { date: { $lte: now } }
          ]
        },
        {
          $or: [
            { 'match_status.state': /finished|ft/i },
            { 'match_status.name': /finished|ft/i },
            { 'match_status': 'FT' },
            { status: /finished|ft/i }
          ]
        }
      ]
    }).sort({ 'match_info.starting_at': -1, date: -1 });
    
    if (lastFinishedMatch) {
      console.log('✅ Backend should return this as Southampton last match:');
      console.log('  Match ID:', lastFinishedMatch.match_id);
      console.log('  Teams:', `${lastFinishedMatch.teams?.home?.team_name} vs ${lastFinishedMatch.teams?.away?.team_name}`);
      console.log('  Date:', lastFinishedMatch.match_info?.starting_at || lastFinishedMatch.date);
      console.log('  Status:', lastFinishedMatch.match_status);
      
      if (lastFinishedMatch.match_id === 19432044) {
        console.log('🎉 SUCCESS! Match 19432044 is now Southampton\'s last match!');
      } else {
        console.log('⚠️  Match 19432044 is not the latest. The latest is:', lastFinishedMatch.match_id);
      }
    }
    
    // Check formation data
    console.log('\n=== FORMATION DATA CHECK ===');
    if (match19432044.lineup) {
      console.log('✅ Lineup data exists');
      
      const homeLineup = match19432044.lineup.home;
      const awayLineup = match19432044.lineup.away;
      
      console.log('Home team (Southampton) formation:');
      homeLineup.forEach((player, i) => {
        if (i < 5) { // Show first 5 players
          console.log(`  ${player.player_name}: pos=${player.formation_position}, field=${player.formation_field}`);
        }
      });
      
      console.log('Away team (Millwall) formation:');
      awayLineup.forEach((player, i) => {
        if (i < 5) { // Show first 5 players
          console.log(`  ${player.player_name}: pos=${player.formation_position}, field=${player.formation_field}`);
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});