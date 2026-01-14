require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

const DBURI = process.env.DBURI;
mongoose.connect(DBURI);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    
    console.log('\n=== TESTING SOUTHAMPTON LAST MATCH LOGIC ===');
    
    const now = new Date();
    console.log('Current time:', now.toISOString());
    
    // This replicates the backend logic for finding the last match
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
      console.log('  Has formation data?', lastFinishedMatch.lineup ? 'Yes' : 'No');
      
      if (lastFinishedMatch.lineup) {
        console.log('  Home lineup players:', lastFinishedMatch.lineup.home?.length || 0);
        console.log('  Away lineup players:', lastFinishedMatch.lineup.away?.length || 0);
        
        // Check if Southampton lineup has formation data
        const southamptonTeamId = 65;
        const isHome = lastFinishedMatch.teams?.home?.team_id === southamptonTeamId;
        const southamptonLineup = isHome ? lastFinishedMatch.lineup.home : lastFinishedMatch.lineup.away;
        
        if (southamptonLineup && southamptonLineup.length > 0) {
          console.log('\n  📊 Southampton lineup formation data:');
          const playersWithFormation = southamptonLineup.filter(p => p.formation_position || p.formation_field);
          console.log(`  Players with formation data: ${playersWithFormation.length}/${southamptonLineup.length}`);
          
          if (playersWithFormation.length > 0) {
            console.log('  Sample formation data:');
            playersWithFormation.slice(0, 3).forEach(player => {
              console.log(`    ${player.player_name}: position=${player.formation_position}, field=${player.formation_field}`);
            });
          }
        }
      }
    } else {
      console.log('❌ No finished Southampton matches found by backend logic');
    }
    
    // Check specifically match 19431955
    console.log('\n=== DETAILED CHECK OF MATCH 19431955 ===');
    const match19431955 = await Match.findOne({ match_id: 19431955 });
    if (match19431955) {
      console.log('Match 19431955 details:');
      console.log('  Date fields:');
      console.log('    match_info.starting_at:', match19431955.match_info?.starting_at);
      console.log('    date:', match19431955.date);
      console.log('    Date comparison with now:');
      console.log('      starting_at <= now?', new Date(match19431955.match_info?.starting_at) <= now);
      console.log('      date <= now?', new Date(match19431955.date || 0) <= now);
      
      console.log('  Status fields:');
      console.log('    match_status:', match19431955.match_status);
      console.log('    status:', match19431955.status);
      console.log('    Status matching logic:');
      console.log('      match_status.state matches /finished|ft/i?', /finished|ft/i.test(match19431955.match_status?.state || ''));
      console.log('      match_status matches "FT"?', match19431955.match_status === 'FT');
      console.log('      match_status.state === "FT"?', match19431955.match_status?.state === 'FT');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});