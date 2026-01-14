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
    
    console.log('ALL EVENTS in the match:');
    console.log(`Total events: ${match.events.length}\n`);
    
    // Get unique event types
    const eventTypes = [...new Set(match.events.map(e => e.type))];
    console.log('Event types found:', eventTypes);
    
    // Show all events to understand the structure
    match.events.forEach((event, index) => {
      if (index < 20) { // Show first 20 events to understand structure
        console.log(`Event ${index + 1}:`);
        console.log(`  ID: ${event.id}`);
        console.log(`  Minute: ${event.minute}`);
        console.log(`  Type: ${event.type}`);
        console.log(`  Player: "${event.player_name || 'None'}"`);
        console.log(`  Team: ${event.team_name || event.team || 'None'}`);
        console.log(`  Comment: "${event.comment || 'None'}"`);
        console.log(`  Info: "${event.info || 'None'}"`);
        console.log('---');
      }
    });
    
    const goals = match.events.filter(e => e.type === 'goal' || e.type === 'GOAL');
    console.log(`\nFound ${goals.length} goal events\n`);
    
    goals.forEach((goal, index) => {
      console.log(`Goal ${index + 1}:`);
      console.log(`  ID: ${goal.id}`);
      console.log(`  Minute: ${goal.minute}'`);
      console.log(`  Type: ${goal.type}`);
      console.log(`  Player: "${goal.player_name || 'None'}"`);
      console.log(`  Team: ${goal.team_name || goal.team}`);
      console.log(`  Comment: "${goal.comment || 'None'}"`);
      console.log(`  Info: "${goal.info || 'None'}"`);
      console.log(`  Addition: "${goal.addition || 'None'}"`);
      console.log('---');
    });

    // Check for duplicates based on minute 43 (case insensitive)
    console.log('\nChecking for goals around minute 43:');
    const minute43Goals = match.events.filter(e => 
      e.type && e.type.toUpperCase() === 'GOAL' && e.minute === 43
    );
    console.log(`Found ${minute43Goals.length} goals at minute 43\n`);
    
    minute43Goals.forEach((goal, idx) => {
      console.log(`43' Goal ${idx + 1}:`);
      console.log(`  ID: ${goal.id}`);
      console.log(`  Player: ${goal.player_name}`);
      console.log(`  Team: ${goal.team_name || goal.team}`);
      console.log(`  Comment: "${goal.comment}"`);
      console.log(`  Info: "${goal.info}"`);
      console.log(`  Addition: "${goal.addition}"`);
      console.log('---');
    });

    // Check for Finn Azaz goals specifically
    console.log('\nAll Finn Azaz goals:');
    const finnAzazGoals = goals.filter(g => g.player_name && g.player_name.includes('Finn Azaz'));
    console.log(`Found ${finnAzazGoals.length} Finn Azaz goals\n`);
    
    finnAzazGoals.forEach((goal, idx) => {
      console.log(`Finn Azaz Goal ${idx + 1}:`);
      console.log(`  ID: ${goal.id}`);
      console.log(`  Minute: ${goal.minute}'`);
      console.log(`  Info: "${goal.info}"`);
      console.log(`  Comment: "${goal.comment}"`);
      console.log(`  Addition: "${goal.addition}"`);
      console.log('---');
    });

    // Check for potential duplicates - same player, minute, and info
    console.log('\nChecking for duplicate goals (same player, minute, and info):');
    const goalSignatures = {};
    goals.forEach((goal, index) => {
      const signature = `${goal.player_name}_${goal.minute}_${goal.info}_${goal.comment}`;
      if (!goalSignatures[signature]) {
        goalSignatures[signature] = [];
      }
      goalSignatures[signature].push({ index, goal });
    });
    
    let duplicatesFound = false;
    Object.entries(goalSignatures).forEach(([signature, goalGroup]) => {
      if (goalGroup.length > 1) {
        duplicatesFound = true;
        console.log(`\nDUPLICATE FOUND: ${signature}`);
        goalGroup.forEach(({ index, goal }) => {
          console.log(`  Goal ${index + 1}: ID ${goal.id}, Minute ${goal.minute}, Player: ${goal.player_name}`);
        });
      }
    });
    
    if (!duplicatesFound) {
      console.log('No exact duplicates found based on player+minute+info+comment combination');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();