require('dotenv').config();
require('./db/connect.js');
const Match = require('./models/Match.js');

async function checkMatch() {
    try {
        const match = await Match.findOne({ match_id: 19431929 });
        
        if (!match) {
            console.log('Match 19431929 not found');
            return;
        }
        
        console.log('Match found:', match.match_id);
        console.log('Teams:', match.teams?.home?.team_name, 'vs', match.teams?.away?.team_name);
        
        if (!match.events) {
            console.log('No events found');
            return;
        }
        
        const goals = match.events.filter(e => e.type === 'goal');
        console.log('\nTotal goals:', goals.length);
        
        // Group goals by minute and comment to find duplicates
        const goalsByMinuteAndComment = {};
        
        goals.forEach((goal, i) => {
            const key = `${goal.minute}_${goal.comment}`;
            if (!goalsByMinuteAndComment[key]) {
                goalsByMinuteAndComment[key] = [];
            }
            goalsByMinuteAndComment[key].push({ index: i, goal });
            
            console.log(`Goal ${i+1}:`);
            console.log(`  Minute: ${goal.minute}'`);
            console.log(`  Comment: "${goal.comment}"`);
            console.log(`  Player: ${goal.player_name}`);
            console.log(`  Team: ${goal.team_name}`);
            console.log();
        });
        
        // Check for duplicates
        console.log('=== DUPLICATE ANALYSIS ===');
        let foundDuplicates = false;
        
        Object.entries(goalsByMinuteAndComment).forEach(([key, goalGroup]) => {
            if (goalGroup.length > 1) {
                foundDuplicates = true;
                console.log(`\nDuplicate found for minute/comment: ${key}`);
                goalGroup.forEach(({ index, goal }) => {
                    console.log(`  Goal ${index+1}: ${goal.player_name} (${goal.team_name})`);
                });
            }
        });
        
        if (!foundDuplicates) {
            console.log('No duplicates found based on minute + comment combination');
        }
        
        // Also check for goals with same minute regardless of comment
        console.log('\n=== SAME MINUTE ANALYSIS ===');
        const goalsByMinute = {};
        goals.forEach((goal, i) => {
            if (!goalsByMinute[goal.minute]) {
                goalsByMinute[goal.minute] = [];
            }
            goalsByMinute[goal.minute].push({ index: i, goal });
        });
        
        Object.entries(goalsByMinute).forEach(([minute, goalGroup]) => {
            if (goalGroup.length > 1) {
                console.log(`\nMultiple goals in minute ${minute}:`);
                goalGroup.forEach(({ index, goal }) => {
                    console.log(`  Goal ${index+1}: "${goal.comment}" by ${goal.player_name} (${goal.team_name})`);
                });
            }
        });
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        process.exit(0);
    }
}

setTimeout(checkMatch, 2000);