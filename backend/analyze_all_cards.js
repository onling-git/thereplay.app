require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./db/connect');
const Match = require('./models/Match');

(async () => {
  await connectDB(process.env.DBURI);
  
  try {
    const match = await Match.findOne({ match_id: 19431929 });
    if (!match) {
      console.log('Match not found');
      process.exit(1);
    }
    
    console.log('All current events that might be yellow cards or fouls:');
    
    // Look at all events that might be yellow cards or related fouls
    const suspiciousEvents = match.events.filter(e => 
      e.type === 'YELLOWCARD' || 
      e.type === 'FOUL' || 
      (e.info && e.info.toLowerCase().includes('yellow')) ||
      (e.addition && e.addition.toLowerCase().includes('yellowcard'))
    );
    
    // Group by minute for easier analysis
    const eventsByMinute = {};
    suspiciousEvents.forEach(event => {
      if (!eventsByMinute[event.minute]) eventsByMinute[event.minute] = [];
      eventsByMinute[event.minute].push(event);
    });
    
    console.log('\nEvents grouped by minute:');
    Object.keys(eventsByMinute).sort((a, b) => parseInt(a) - parseInt(b)).forEach(minute => {
      console.log(`\nMinute ${minute}:`);
      eventsByMinute[minute].forEach(event => {
        console.log(`  ID: ${event.id}, Type: ${event.type}, Player: ${event.player_name || 'None'}`);
        console.log(`      Info: "${event.info}", Addition: "${event.addition}"`);
      });
    });

    // Analysis: Find events that should be consolidated
    console.log('\n=== ANALYSIS ===');
    const yellowCardMinutes = Object.keys(eventsByMinute).filter(minute => 
      eventsByMinute[minute].some(e => e.type === 'YELLOWCARD' || (e.addition && e.addition.includes('Yellowcard')))
    );
    
    yellowCardMinutes.forEach(minute => {
      console.log(`\nMinute ${minute} analysis:`);
      const events = eventsByMinute[minute];
      const yellowCards = events.filter(e => e.type === 'YELLOWCARD');
      const fouls = events.filter(e => e.type === 'FOUL' && e.addition && e.addition.includes('Yellowcard'));
      
      console.log(`  Current yellow card events: ${yellowCards.length}`);
      console.log(`  Current foul events with yellow card addition: ${fouls.length}`);
      console.log(`  Should be: 1 yellow card event per player`);
      
      // Determine unique players who should have yellow cards this minute
      const playersWithCards = new Set();
      events.forEach(e => {
        if ((e.type === 'YELLOWCARD' || (e.addition && e.addition.includes('Yellowcard'))) && e.player_name) {
          playersWithCards.add(e.player_name);
        }
      });
      
      console.log(`  Players who should have cards: ${Array.from(playersWithCards).join(', ')}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();