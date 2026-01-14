const mongoose = require('mongoose');
const { get } = require('./utils/sportmonks');

async function debugCupFixtureData() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.DBURI);
        console.log('✅ Connected to MongoDB');

        console.log('⚽ Fetching Southampton FA Cup fixture data...');
        
        const fixtureData = await get('/fixtures/19615714', {
            include: 'participants'
        });
        
        const fixture = fixtureData?.data?.data;
        console.log('\n📋 Raw fixture data:');
        console.log('- ID:', fixture.id);
        console.log('- Name:', fixture.name);
        console.log('- Participants:', fixture.participants);
        
        if (fixture.participants) {
            console.log('\n👥 Detailed participants:');
            fixture.participants.forEach((p, index) => {
                console.log(`Participant ${index + 1}:`);
                console.log('  - ID:', p.id);
                console.log('  - Name:', p.name);
                console.log('  - Meta:', p.meta);
                console.log('  - Location:', p.meta?.location);
            });
        }

        // Test the normalization function
        console.log('\n🧪 Testing normalization...');
        
        const participants = fixture.participants || [];
        const home = participants.find(p => p.meta?.location === 'home');
        const away = participants.find(p => p.meta?.location === 'away');
        
        console.log('Home team found:', home);
        console.log('Away team found:', away);
        
        console.log('\n✅ Expected result:');
        console.log('- Home:', home?.name || 'NOT FOUND');
        console.log('- Away:', away?.name || 'NOT FOUND');
        
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('📡 Disconnected from MongoDB');
        process.exit();
    }
}

debugCupFixtureData();