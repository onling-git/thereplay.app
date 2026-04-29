// Direct inspection of match 19687560 using the same connection as the main app
const mongoose = require('mongoose');
require('dotenv').config();

// Use the same connection string as the main app
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';

const matchSchema = new mongoose.Schema({}, { strict: false, collection: 'matches' });
const Match = mongoose.model('Match', matchSchema);

async function inspectMatch() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to:', MONGODB_URI);
    
    const match = await Match.findOne({ match_id: 19687560 }).lean();
    
    if (!match) {
      console.log('\n❌ Match 19687560 NOT FOUND');
      
      // Try to find matches around this ID
      const nearby = await Match.find({ 
        match_id: { $gte: 19687550, $lte: 19687570 } 
      }).select('match_id teams.home.team_name teams.away.team_name').lean();
      
      console.log(`\nFound ${nearby.length} matches in range 19687550-19687570:`);
      nearby.forEach(m => {
        console.log(`  ${m.match_id}: ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name}`);
      });
      
      return;
    }
    
    console.log('\n✅ Match FOUND!');
    console.log('Match ID:', match.match_id);
    console.log('Teams:', match.teams?.home?.team_name, 'vs', match.teams?.away?.team_name);
    console.log('Score:', `${match.score?.home || 0}-${match.score?.away || 0}`);
    console.log('Status:', match.match_status?.state || match.status);
    
    console.log('\n=== ALL EVENTS ===');
    if (!match.events || match.events.length === 0) {
      console.log('No events found!');
      return;
    }
    
    console.log(`Total events: ${match.events.length}\n`);
    
    // Find all goal-related events
    const goalEvents = match.events.filter(e => {
      const type = String(e.type || '').toLowerCase();
      return type.includes('goal');
    });
    
    console.log(`\n=== GOAL EVENTS (${goalEvents.length}) ===`);
    goalEvents.forEach((goal, i) => {
      console.log(`\nGoal ${i + 1}:`);
      console.log(`  ID: ${goal.id}`);
      console.log(`  Minute: ${goal.minute}'`);
      console.log(`  Type: ${goal.type}`);
      console.log(`  Player: ${goal.player_name || 'N/A'}`);
      console.log(`  Team: ${goal.team || 'N/A'}`);
      console.log(`  Participant ID: ${goal.participant_id || 'N/A'}`);
      console.log(`  Comment: ${goal.comment || 'N/A'}`);
      console.log(`  Info: ${goal.info || 'N/A'}`);
    });
    
    // Check team IDs
    console.log(`\n=== TEAM IDs ===`);
    console.log(`Home Team (${match.teams?.home?.team_name}): ID = ${match.teams?.home?.team_id}`);
    console.log(`Away Team (${match.teams?.away?.team_name}): ID = ${match.teams?.away?.team_id}`);
    
    // Group goals by minute to check for duplicates
    console.log(`\n=== GOALS BY MINUTE ===`);
    const goalsByMinute = {};
    goalEvents.forEach(g => {
      const min = g.minute || 'unknown';
      if (!goalsByMinute[min]) goalsByMinute[min] = [];
      goalsByMinute[min].push(g);
    });
    
    Object.keys(goalsByMinute).sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      return numA - numB;
    }).forEach(min => {
      const goals = goalsByMinute[min];
      console.log(`\n${min}': ${goals.length} goal(s)`);
      goals.forEach((g, i) => {
        console.log(`  ${i + 1}. ${g.player_name} (${g.type}) - ParticipantID: ${g.participant_id}`);
      });
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
}

inspectMatch();
