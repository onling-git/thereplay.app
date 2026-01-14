const { get } = require('./utils/sportmonks');

async function debugSouthamptonFixture() {
    try {
        console.log('⚽ Fetching Southampton FA Cup fixture (ID: 19615714)...');
        
        const fixtureData = await get('/fixtures/19615714', {
            include: 'participants'
        });
        
        console.log('📊 API response structure:');
        console.log('Type:', typeof fixtureData);
        console.log('Keys:', Object.keys(fixtureData || {}));
        
        console.log('📋 Raw data field:');
        console.log('Data type:', typeof fixtureData.data);
        console.log('Data:', fixtureData.data);
        
        if (fixtureData && fixtureData.data) {
            console.log('📋 Fixture data:');
            const fixture = fixtureData.data;
            console.log('- ID:', fixture.id);
            console.log('- Name:', fixture.name);
            console.log('- Starting at:', fixture.starting_at);
            console.log('- League ID:', fixture.league_id);
            console.log('- Stage ID:', fixture.stage_id);
            console.log('- Has participants:', !!fixture.participants);
            if (fixture.participants) {
                console.log('- Participants count:', fixture.participants.length);
                fixture.participants.forEach(p => {
                    console.log(`  - ${p.name} (${p.meta?.location})`);
                });
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugSouthamptonFixture();