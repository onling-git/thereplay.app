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
    
    console.log('Match:', match.teams.home.team_name, 'vs', match.teams.away.team_name);
    console.log('All yellow card events:');
    const allYellowCards = match.events.filter(e => e.type === 'YELLOWCARD');
    allYellowCards.forEach((event, index) => {
      console.log('Yellow Card ' + (index + 1) + ':');
      console.log('  ID: ' + event.id);
      console.log('  Minute: ' + event.minute);
      console.log('  Type: ' + event.type);
      console.log('  Player: ' + event.player_name);
      console.log('  Team: ' + event.team);
      console.log('  Info: ' + event.info);
      console.log('  Addition: ' + event.addition);
      console.log('---');
    });
    
    console.log('\nMatch events around minutes 60-61:');
    const events = match.events.filter(e => e.minute >= 59 && e.minute <= 62);
    events.forEach((event, index) => {
      console.log('Event ' + (index + 1) + ':');
      console.log('  ID: ' + event.id);
      console.log('  Minute: ' + event.minute);
      console.log('  Type: ' + event.type);
      console.log('  Player: ' + event.player_name);
      console.log('  Team: ' + event.team);
      console.log('  Participant ID: ' + event.participant_id);
      console.log('---');
    });
    
    // Check for duplicates
    const yellowCards = match.events.filter(e => e.type === 'YELLOWCARD');
    console.log('\nTotal yellow cards: ' + yellowCards.length);
    
    const duplicateCheck = {};
    yellowCards.forEach(card => {
      const key = card.minute + '-' + card.player_name + '-' + card.participant_id;
      if (!duplicateCheck[key]) {
        duplicateCheck[key] = [];
      }
      duplicateCheck[key].push(card);
    });
    
    console.log('\nDuplicate yellow cards:');
    Object.entries(duplicateCheck).forEach(([key, cards]) => {
      if (cards.length > 1) {
        console.log('Key: ' + key + ' - ' + cards.length + ' duplicates');
        cards.forEach((card, idx) => {
          console.log('  Duplicate ' + (idx + 1) + ': ID=' + card.id + ', minute=' + card.minute + ', player=' + card.player_name);
        });
      }
    });

    // Also check all events by ID for duplicates
    console.log('\nChecking all events for duplicate IDs:');
    const eventIdMap = {};
    match.events.forEach(event => {
      if (event.id) {
        if (!eventIdMap[event.id]) {
          eventIdMap[event.id] = [];
        }
        eventIdMap[event.id].push(event);
      }
    });

    Object.entries(eventIdMap).forEach(([id, events]) => {
      if (events.length > 1) {
        console.log('Duplicate Event ID ' + id + ' found ' + events.length + ' times:');
        events.forEach((event, idx) => {
          console.log('  Event ' + (idx + 1) + ': minute=' + event.minute + ', type=' + event.type + ', player=' + event.player_name);
        });
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();