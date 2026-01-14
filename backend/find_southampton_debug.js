const mongoose = require('mongoose');
const Team = require('./models/Team');

async function findSouthampton() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay');
        console.log('✅ Connected to MongoDB');

        console.log('🔍 Looking for Southampton with SportMonks ID 65...');
        
        // Try different field names for team ID
        const queries = [
            { team_id: 65 },
            { sportmonks_id: 65 },
            { id: 65 },
            { 'team_id': '65' }, // string version
            { name: { $regex: 'southampton', $options: 'i' } }
        ];
        
        for (let i = 0; i < queries.length; i++) {
            console.log(`\nQuery ${i + 1}: ${JSON.stringify(queries[i])}`);
            const team = await Team.findOne(queries[i]);
            if (team) {
                console.log(`✅ Found: ${team.name}`);
                console.log(`- Database ID: ${team._id}`);
                console.log(`- Team ID field: ${team.team_id}`);
                console.log(`- Next match: ${team.next_match}`);
                console.log(`- All fields:`, Object.keys(team.toObject()));
                return team;
            } else {
                console.log('❌ Not found');
            }
        }
        
        console.log('\n📋 Let me check what teams are actually in the database...');
        const sampleTeams = await Team.find({}).limit(3);
        sampleTeams.forEach((team, idx) => {
            console.log(`${idx + 1}. ${team.name} - team_id: ${team.team_id}, _id: ${team._id}`);
        });

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

findSouthampton();