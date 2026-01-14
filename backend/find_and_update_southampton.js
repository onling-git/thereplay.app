const mongoose = require('mongoose');
const Team = require('./models/Team');
const Match = require('./models/Match');

async function findAndUpdateSouthampton() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay');
        console.log('✅ Connected to MongoDB');

        // Search for Southampton with different patterns
        console.log('🔍 Searching for Southampton team...');
        
        const patterns = [
            { name: { $regex: 'southampton', $options: 'i' } },
            { name: { $regex: 'saints', $options: 'i' } },
            { short_name: { $regex: 'sou', $options: 'i' } }
        ];
        
        for (let i = 0; i < patterns.length; i++) {
            const teams = await Team.find(patterns[i]);
            console.log(`Pattern ${i + 1}: Found ${teams.length} teams`);
            teams.forEach(team => {
                console.log(`- ${team.name} (ID: ${team._id}, next_match: ${team.next_match})`);
            });
        }
        
        // Also search by the known team ID 65 from the SportMonks data
        console.log('\n🔍 Searching by SportMonks team ID 65...');
        const teamById = await Team.findOne({ team_id: 65 });
        if (teamById) {
            console.log(`Found by team_id: ${teamById.name} (ID: ${teamById._id})`);
            console.log(`Current next_match: ${teamById.next_match}`);
            
            // Now find today's FA Cup match
            const facupMatch = await Match.findOne({ 
                match_id: 19615714,
                $or: [
                    { 'teams.home.name': /southampton/i },
                    { 'teams.away.name': /southampton/i }
                ]
            });
            
            if (facupMatch) {
                console.log(`\n🏆 Found FA Cup match: ${facupMatch._id}`);
                console.log(`Updating Southampton's next_match...`);
                
                teamById.next_match = facupMatch._id;
                await teamById.save();
                
                console.log(`✅ Updated Southampton's next_match to: ${facupMatch._id}`);
            } else {
                console.log('❌ FA Cup match not found');
            }
        } else {
            console.log('❌ Southampton not found by team_id 65');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

findAndUpdateSouthampton();