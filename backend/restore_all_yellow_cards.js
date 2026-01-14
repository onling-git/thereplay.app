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
    
    console.log('Restoring all 4 yellow card events based on original data...\n');
    
    // Based on original analysis, there should be 4 yellow cards:
    // 1st Yellowcard - Tyreece Campbell (60')
    // 2nd Yellowcard - Greg Docherty (61') 
    // 3rd Yellowcard - Kayne Ramsay (75')
    // 4th Yellowcard - Joe Rankin-Costello (77')
    
    const correctYellowCards = [
      {
        id: 152173088,
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
        id: 152173191,
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
      },
      {
        id: 152173476,
        fixture_id: match.match_id,
        period_id: 2,
        detailed_period_id: 14,
        participant_id: 4,
        minute: 75,
        extra_minute: null,
        type_id: 19,
        type: 'YELLOWCARD',
        sub_type_id: null,
        sub_type: null,
        player_id: null,
        player_name: 'Kayne Ramsay',
        related_player_id: null,
        related_player_name: '',
        player: 'Kayne Ramsay',
        related_player: '',
        team: 'home',
        injured: null,
        on_bench: false,
        coach_id: null,
        sort_order: null,
        result: null,
        info: 'Yellow Card',
        addition: '3rd Yellowcard',
        rescinded: false
      },
      {
        id: 152173589,
        fixture_id: match.match_id,
        period_id: 2,
        detailed_period_id: 14,
        participant_id: 4,
        minute: 77,
        extra_minute: null,
        type_id: 19,
        type: 'YELLOWCARD',
        sub_type_id: null,
        sub_type: null,
        player_id: null,
        player_name: 'Joe Rankin-Costello',
        related_player_id: null,
        related_player_name: '',
        player: 'Joe Rankin-Costello',
        related_player: '',
        team: 'home',
        injured: null,
        on_bench: false,
        coach_id: null,
        sort_order: null,
        result: null,
        info: 'Yellow Card',
        addition: '4th Yellowcard',
        rescinded: false
      }
    ];
    
    // Remove existing yellow cards and add the complete set
    const cleanEvents = match.events.filter(e => e.type !== 'YELLOWCARD');
    cleanEvents.push(...correctYellowCards);
    
    // Update the match
    await Match.findOneAndUpdate(
      { match_id: 19431929 },
      { $set: { events: cleanEvents } }
    );
    
    console.log('Restored all 4 yellow card events:');
    const finalMatch = await Match.findOne({ match_id: 19431929 });
    const yellowCards = finalMatch.events.filter(e => e.type === 'YELLOWCARD');
    
    console.log(`Total yellow cards: ${yellowCards.length}`);
    yellowCards
      .sort((a, b) => a.minute - b.minute)
      .forEach((card, idx) => {
        console.log(`  ${card.minute}': ${card.player_name} (${card.addition})`);
      });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();