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
    
    console.log('Reverting and fixing properly...\n');
    
    // The correct fix: Keep ONLY the actual yellow card events with proper player attribution
    // Remove all the mess we created and build clean yellow card events
    
    const correctEvents = match.events.filter(event => {
      // Remove our temporary events and misclassified ones
      return event.id !== 999999000 && event.id !== 999999001 && 
             !(event.type === 'FOUL' && [152173088, 152173191, 152173476, 152173589].includes(event.id));
    });
    
    // Add back the proper yellow card events - one per actual card
    // Based on the original "addition" field, we know:
    // - 1st Yellowcard = Tyreece Campbell (minute 60)
    // - 2nd Yellowcard = Greg Docherty (minute 61) 
    
    const yellowCardEvents = [
      {
        id: 152173088, // Reuse existing ID
        fixture_id: match.match_id,
        period_id: 2,
        detailed_period_id: 14,
        participant_id: 4,
        minute: 60,
        extra_minute: null,
        type_id: 19,
        type: 'YELLOWCARD',
        sub_type_id: null,
        sub_type: null,
        player_id: null,
        player_name: 'Tyreece Campbell',
        related_player_id: null,
        related_player_name: '',
        player: 'Tyreece Campbell',
        related_player: '',
        team: 'home',
        injured: null,
        on_bench: false,
        coach_id: null,
        sort_order: null,
        result: null,
        info: 'Yellow Card',
        addition: '1st Yellowcard',
        rescinded: false
      },
      {
        id: 152173191, // Reuse existing ID  
        fixture_id: match.match_id,
        period_id: 2,
        detailed_period_id: 14,
        participant_id: 4,
        minute: 61,
        extra_minute: null,
        type_id: 19,
        type: 'YELLOWCARD',
        sub_type_id: null,
        sub_type: null,
        player_id: null,
        player_name: 'Greg Docherty ',
        related_player_id: null,
        related_player_name: '',
        player: 'Greg Docherty ',
        related_player: '',
        team: 'home',
        injured: null,
        on_bench: false,
        coach_id: null,
        sort_order: null,
        result: null,
        info: 'Yellow Card',
        addition: '2nd Yellowcard',
        rescinded: false
      }
    ];
    
    // Add the clean yellow card events
    correctEvents.push(...yellowCardEvents);
    
    // Update the match with clean events
    const updateResult = await Match.findOneAndUpdate(
      { match_id: 19431929 },
      { $set: { events: correctEvents } },
      { new: true }
    );
    
    console.log('After proper fix:');
    const finalMatch = await Match.findOne({ match_id: 19431929 });
    const yellowCards = finalMatch.events.filter(e => e.type === 'YELLOWCARD');
    const fouls = finalMatch.events.filter(e => e.type === 'FOUL');
    
    console.log(`Yellow cards: ${yellowCards.length}`);
    console.log(`Fouls: ${fouls.length}`);
    
    yellowCards.forEach((card, idx) => {
      console.log(`Yellow Card ${idx + 1}: minute=${card.minute}, player=${card.player_name}, info=${card.info}`);
    });
    
    console.log('\nEvents in minutes 60-61:');
    finalMatch.events
      .filter(e => e.minute >= 60 && e.minute <= 61)
      .sort((a, b) => a.minute - b.minute)
      .forEach(event => {
        console.log(`  ${event.minute}' ${event.type}: ${event.player_name || 'No player'} - ${event.info}`);
      });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();