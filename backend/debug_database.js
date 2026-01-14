const mongoose = require('mongoose');

async function debugDatabase() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        const connection = await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay');
        console.log('✅ Connected to MongoDB');
        console.log('📍 Database name:', connection.connection.db.databaseName);

        // List all collections
        console.log('\n📂 Collections in database:');
        const collections = await mongoose.connection.db.listCollections().toArray();
        collections.forEach(col => {
            console.log(`- ${col.name} (type: ${col.type})`);
        });

        // Check if teams collection exists and has documents
        if (collections.some(col => col.name === 'teams')) {
            console.log('\n👥 Teams collection found, checking documents...');
            const teamsCount = await mongoose.connection.db.collection('teams').countDocuments();
            console.log(`📊 Teams count: ${teamsCount}`);
            
            if (teamsCount > 0) {
                const sampleTeams = await mongoose.connection.db.collection('teams').find({}).limit(3).toArray();
                console.log('\n📋 Sample teams:');
                sampleTeams.forEach((team, idx) => {
                    console.log(`${idx + 1}. ${team.name || 'No name'} - _id: ${team._id}`);
                    console.log(`   Fields: ${Object.keys(team).join(', ')}`);
                });
            }
        }

        // Check matches collection too
        if (collections.some(col => col.name === 'matches')) {
            console.log('\n⚽ Matches collection found, checking documents...');
            const matchesCount = await mongoose.connection.db.collection('matches').countDocuments();
            console.log(`📊 Matches count: ${matchesCount}`);
            
            if (matchesCount > 0) {
                const recentMatches = await mongoose.connection.db.collection('matches').find({}).limit(2).toArray();
                console.log('\n📋 Sample matches:');
                recentMatches.forEach((match, idx) => {
                    console.log(`${idx + 1}. ${match.teams?.home?.name || 'Unknown'} vs ${match.teams?.away?.name || 'Unknown'}`);
                    console.log(`   Match ID: ${match.match_id}, Date: ${match.date}`);
                });
            }
        }

    } catch (error) {
        console.error('❌ Database error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

debugDatabase();