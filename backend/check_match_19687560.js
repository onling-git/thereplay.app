// Check match 19687560 goals
const mongoose = require('mongoose');
const Match = require('./models/Match');

mongoose.connect('mongodb://localhost:27017/thefinalplay', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

async function checkMatch() {
  try {
    // Try to find the match with Manchester City
    let match = await Match.findOne({ match_id: 19687560 });
    
    if (!match) {
      console.log('Match 19687560 not found - trying broader search...');
      // Try to find any match around this ID
      match = await Match.findOne({
        match_id: { $gte: 19687550, $lte: 19687570 }
      });
      
      if (match) {
        console.log('Found nearby match:', match.match_id);
      } else {
        console.log('No matches found in range');
        // List recent Man City matches
        const recentMatches = await Match.find({
          $or: [
            { 'teams.home.team_name': /Manchester City/i },
            { 'teams.away.team_name': /Manchester City/i }
          ]
        }).sort({ 'match_info.starting_at': -1 }).limit(5).lean();
        
        console.log('\n=== Recent Manchester City Matches ===');
        recentMatches.forEach(m => {
          console.log(`Match ${m.match_id}: ${m.teams.home.team_name} vs ${m.teams.away.team_name} - Score: ${m.score?.home || 0}-${m.score?.away || 0}`);
        });
        return;
      }
    }
    
    console.log('Match found:', match.match_id);
    console.log('Teams:', match.teams?.home?.team_name, 'vs', match.teams?.away?.team_name);
    console.log('Score:', match.score);
    console.log('\n=== EVENTS ===');
    
    if (!match.events) {
      console.log('No events found');
      return;
    }
    
    // Filter goals
    const goals = match.events.filter(e => {
      const type = String(e.type || '').toLowerCase();
      return type.includes('goal');
    });
    
    console.log(`\nTotal goals found: ${goals.length}`);
    console.log('Expected: 4 goals based on 4-0 score\n');
    
    goals.forEach((goal, i) => {
      console.log(`Goal ${i + 1}:`);
      console.log(`  ID: ${goal.id}`);
      console.log(`  Minute: ${goal.minute}'`);
      console.log(`  Type: ${goal.type}`);
      console.log(`  Player: "${goal.player_name || 'None'}"`);
      console.log(`  Team: ${goal.team_name || goal.team || 'None'}`);
      console.log(`  Comment: "${goal.comment || 'None'}"`);
      console.log(`  Info: "${goal.info || 'None'}"`);
      console.log(`  Related Comment: ${goal.related_comment_id || 'None'}`);
      console.log('---\n');
    });
    
    // Check all events around minute 39
    console.log('\n=== ALL EVENTS AROUND MINUTE 39 ===');
    const events39 = match.events.filter(e => e.minute >= 37 && e.minute <= 41);
    events39.forEach(e => {
      console.log(`Minute ${e.minute}' - Type: ${e.type} - Player: ${e.player_name || 'None'} - Comment: ${e.comment || 'None'}`);
    });
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.connection.close();
  }
}

checkMatch();
