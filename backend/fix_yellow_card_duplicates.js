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
    
    console.log('Current yellow card events:');
    const yellowCards = match.events.filter(e => e.type === 'YELLOWCARD');
    yellowCards.forEach((event, index) => {
      console.log(`Yellow Card ${index + 1}:`);
      console.log(`  ID: ${event.id}`);
      console.log(`  Minute: ${event.minute}`);
      console.log(`  Player: ${event.player_name}`);
      console.log(`  Info: ${event.info}`);
      console.log(`  Addition: ${event.addition}`);
      console.log(`  Should keep: ${shouldKeepAsYellowCard(event)}`);
      console.log('---');
    });

    // Apply the fix
    const updatedEvents = match.events.map(event => {
      if (event.type === 'YELLOWCARD' && !shouldKeepAsYellowCard(event)) {
        // Convert foul events back to fouls
        console.log(`Converting event ${event.id} from YELLOWCARD to FOUL`);
        return {
          ...event,
          type: 'FOUL'
        };
      }
      return event;
    });

    console.log(`Events to update: ${updatedEvents.filter(e => e.type === 'FOUL').length} FOULs, ${updatedEvents.filter(e => e.type === 'YELLOWCARD').length} YELLOWCARDs`);

    // Update the match
    const updateResult = await Match.findOneAndUpdate(
      { match_id: 19431929 },
      { $set: { events: updatedEvents } },
      { new: true }
    );
    
    console.log(`Update result: ${updateResult ? 'Success' : 'Failed'}`);

    console.log('\nFixed! Checking again...');
    
    const updatedMatch = await Match.findOne({ match_id: 19431929 });
    const newYellowCards = updatedMatch.events.filter(e => e.type === 'YELLOWCARD');
    console.log(`Yellow cards after fix: ${newYellowCards.length}`);
    
    newYellowCards.forEach((event, index) => {
      console.log(`Yellow Card ${index + 1}:`);
      console.log(`  ID: ${event.id}`);
      console.log(`  Minute: ${event.minute}`);
      console.log(`  Player: ${event.player_name}`);
      console.log(`  Info: ${event.info}`);
      console.log(`  Addition: ${event.addition}`);
      console.log('---');
    });

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();

function shouldKeepAsYellowCard(event) {
  const info = (event.info || '').toLowerCase();
  const addition = (event.addition || '').toLowerCase();
  
  // Based on the data analysis, we should:
  // - Keep events that have empty player_name (these seem to be the card award events)
  // - Convert foul events with player names to FOUL type instead of YELLOWCARD
  
  // If no player name and addition mentions card, this is likely the actual card event
  if (!event.player_name && addition.includes('yellowcard')) {
    return true;
  }
  
  // If it has a player name and info says "Foul", this is the foul that led to the card
  if (event.player_name && info === 'foul') {
    return false;
  }
  
  // Default: if unclear, keep it as yellow card for now
  return true;
}