const mongoose = require('mongoose');
const Match = require('./models/Match');

async function checkSavedMatch() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.DBURI);
        console.log('✅ Connected to MongoDB');

        console.log('🔍 Checking saved FA Cup match...');
        
        const match = await Match.findOne({ match_id: 19615714 });
        
        if (match) {
            console.log('✅ Found match in database:');
            console.log('- Match ID:', match.match_id);
            console.log('- Date:', match.date);
            console.log('- Competition:', match.competition_name);
            console.log('- Teams structure:', JSON.stringify(match.teams, null, 2));
            console.log('- Home team:', match.teams?.home?.name);
            console.log('- Away team:', match.teams?.away?.name);
            console.log('- Stage info:', match.match_info?.stage);
        } else {
            console.log('❌ Match not found in database');
        }

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

checkSavedMatch();