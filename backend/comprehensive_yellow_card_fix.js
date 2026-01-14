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
    
    console.log('Comprehensive fix for yellow card events...\n');
    
    // Group events by minute to understand the relationships
    const eventsByMinute = {};
    match.events.forEach(event => {
      if (!eventsByMinute[event.minute]) eventsByMinute[event.minute] = [];
      eventsByMinute[event.minute].push(event);
    });
    
    // Check minutes 60 and 61 for foul-card pairs
    [60, 61].forEach(minute => {
      console.log(`Minute ${minute}:`);
      const events = eventsByMinute[minute] || [];
      events.forEach(event => {
        console.log(`  ${event.type}: ${event.player_name || 'No player'} (${event.info}) - ${event.addition}`);
      });
    });
    
    // The correct approach: 
    // - Minute 60: Tyreece Campbell should get 1 yellow card (from 1st Yellowcard)
    // - Minute 61: Greg Docherty should get 1 yellow card (from 2nd Yellowcard)
    // - The "5th Yellowcard" seems to be incorrect numbering
    
    // Let's create the correct yellow card events
    const correctYellowCards = [
      {
        minute: 60,
        player_name: 'Tyreece Campbell',
        addition: '1st Yellowcard',
        player_id: null, // We'll need to find this if available
        foulEventId: 152173088
      },
      {
        minute: 61, 
        player_name: 'Greg Docherty ',
        addition: '2nd Yellowcard',
        player_id: null,
        foulEventId: 152173191
      }
    ];
    
    // Remove the incorrect yellow card and add correct ones
    const cleanEvents = match.events.filter(e => e.id !== 152173522); // Remove the playerless yellow card
    
    // Add proper yellow card events
    correctYellowCards.forEach((cardInfo, idx) => {
      const foulEvent = match.events.find(e => e.id === cardInfo.foulEventId);
      if (foulEvent) {
        cleanEvents.push({
          id: 999999000 + idx, // Temporary ID
          fixture_id: foulEvent.fixture_id,
          period_id: foulEvent.period_id,
          detailed_period_id: foulEvent.detailed_period_id,
          participant_id: foulEvent.participant_id,
          minute: cardInfo.minute,
          extra_minute: null,
          type_id: 19,
          type: 'YELLOWCARD',
          sub_type_id: null,
          sub_type: null,
          player_id: foulEvent.player_id,
          player_name: cardInfo.player_name,
          related_player_id: null,
          related_player_name: '',
          player: cardInfo.player_name,
          related_player: '',
          team: foulEvent.team,
          injured: null,
          on_bench: false,
          coach_id: null,
          sort_order: null,
          result: null,
          info: `${cardInfo.player_name} receives a yellow card`,
          addition: cardInfo.addition,
          rescinded: false
        });
      }
    });
    
    // Update the match
    const updateResult = await Match.findOneAndUpdate(
      { match_id: 19431929 },
      { $set: { events: cleanEvents } },
      { new: true }
    );
    
    console.log('\nAfter comprehensive fix:');
    const finalMatch = await Match.findOne({ match_id: 19431929 });
    const yellowCards = finalMatch.events.filter(e => e.type === 'YELLOWCARD');
    const fouls = finalMatch.events.filter(e => e.type === 'FOUL');
    
    console.log(`Yellow cards: ${yellowCards.length}`);
    console.log(`Fouls: ${fouls.length}`);
    
    yellowCards.forEach((card, idx) => {
      console.log(`Yellow Card ${idx + 1}: minute=${card.minute}, player=${card.player_name}, info=${card.info}`);
    });
    
    console.log('\nEvents in minutes 60-61:');
    finalMatch.events.filter(e => e.minute >= 60 && e.minute <= 61).forEach(event => {
      console.log(`  ${event.minute}' ${event.type}: ${event.player_name} - ${event.info}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();