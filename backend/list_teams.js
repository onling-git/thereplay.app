const mongoose = require('mongoose');
const Team = require('./models/Team');

async function listAllTeams() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay');
        console.log('✅ Connected to MongoDB');

        const teams = await Team.find({}).limit(10).sort({ name: 1 });
        console.log(`📋 Found ${teams.length} teams (showing first 10):`);
        
        teams.forEach((team, index) => {
            console.log(`${index + 1}. ${team.name} (ID: ${team._id}, team_id: ${team.team_id || 'N/A'}, next_match: ${team.next_match || 'N/A'})`);
        });

        // Also count total teams
        const totalCount = await Team.countDocuments({});
        console.log(`\n📊 Total teams in database: ${totalCount}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

listAllTeams();