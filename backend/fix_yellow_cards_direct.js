require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB } = require('./db/connect');
const Match = require('./models/Match');

(async () => {
  await connectDB(process.env.DBURI);
  
  try {
    // Get the match directly and update specific events
    const match = await Match.findOne({ match_id: 19431929 });
    if (!match) {
      console.log('Match not found');
      process.exit(1);
    }
    
    console.log('Before fix:');
    const yellowCardsBefore = match.events.filter(e => e.type === 'YELLOWCARD');
    console.log(`Yellow cards: ${yellowCardsBefore.length}`);
    
    // Update events that are fouls but misclassified as yellow cards
    const foulEventIds = [152173088, 152173191, 152173476, 152173589];
    
    const updateResult = await Match.updateOne(
      { match_id: 19431929 },
      {
        $set: {
          "events.$[elem].type": "FOUL"
        }
      },
      {
        arrayFilters: [{ "elem.id": { $in: foulEventIds } }]
      }
    );
    
    console.log('Update result:', updateResult);
    
    // Check the result
    const updatedMatch = await Match.findOne({ match_id: 19431929 });
    const yellowCardsAfter = updatedMatch.events.filter(e => e.type === 'YELLOWCARD');
    const foulsAfter = updatedMatch.events.filter(e => e.type === 'FOUL');
    
    console.log('\nAfter fix:');
    console.log(`Yellow cards: ${yellowCardsAfter.length}`);
    console.log(`Fouls: ${foulsAfter.length}`);
    
    yellowCardsAfter.forEach((card, idx) => {
      console.log(`Yellow Card ${idx + 1}: ID=${card.id}, minute=${card.minute}, player=${card.player_name}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();