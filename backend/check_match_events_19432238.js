// Check what event data exists for match 19432238
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function checkEvents() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    const matchId = 19432238;
    const match = await Match.findOne({ match_id: matchId });

    if (!match) {
      console.log(`❌ Match ${matchId} not found`);
      return;
    }

    console.log('\n📊 Match:', match.teams?.home?.team_name, 'vs', match.teams?.away?.team_name);
    console.log('Score:', match.score?.home, '-', match.score?.away);
    console.log('');

    console.log('='.repeat(80));
    console.log('EVENTS DATA');
    console.log('='.repeat(80));
    
    if (!match.events || match.events.length === 0) {
      console.log('⚠️ No events found!');
    } else {
      console.log(`Total events: ${match.events.length}`);
      console.log('');
      
      // Show all goal events
      const goals = match.events.filter(e => e.type === 'goal');
      console.log(`\nGOALS (${goals.length}):`);
      goals.forEach(g => {
        console.log(JSON.stringify(g, null, 2));
      });
      
      // Show first 10 events
      console.log('\n\nFIRST 10 EVENTS:');
      match.events.slice(0, 10).forEach((event, i) => {
        console.log(`\n${i + 1}.`, JSON.stringify(event, null, 2));
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkEvents();
