require('dotenv').config();
const axios = require('axios');

async function checkSouthamptonUpcomingFACup() {
    try {
        console.log('🔍 Checking Southampton\'s upcoming fixtures from SportMonks...');
        
        // Get next 7 days of fixtures
        const dates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(date.getDate() + i);
            dates.push(date.toISOString().split('T')[0]);
        }
        
        for (const dateStr of dates) {
            console.log(`\n📅 Checking fixtures for ${dateStr}...`);
            
            const response = await axios.get(
                `${process.env.SPORTMONKS_BASE}/fixtures/date/${dateStr}`,
                {
                    params: {
                        api_token: process.env.SPORTMONKS_API_KEY
                    }
                }
            );
            
            const fixtures = response.data?.data || [];
            console.log(`Found ${fixtures.length} total fixtures`);
            
            // Filter for Southampton matches
            const southamptonFixtures = fixtures.filter(fixture => {
                const homeName = fixture.participants?.find(p => p.meta?.location === 'home')?.name || '';
                const awayName = fixture.participants?.find(p => p.meta?.location === 'away')?.name || '';
                
                return homeName.toLowerCase().includes('southampton') || 
                       awayName.toLowerCase().includes('southampton');
            });
            
            if (southamptonFixtures.length > 0) {
                console.log(`🎯 Found ${southamptonFixtures.length} Southampton fixtures:`);
                southamptonFixtures.forEach(fixture => {
                    const home = fixture.participants?.find(p => p.meta?.location === 'home')?.name || 'Unknown';
                    const away = fixture.participants?.find(p => p.meta?.location === 'away')?.name || 'Unknown';
                    const leagueName = fixture.league?.name || 'Unknown League';
                    
                    console.log(`- ${home} vs ${away} (${leagueName})`);
                    console.log(`  League ID: ${fixture.league?.id}`);
                    console.log(`  Fixture ID: ${fixture.id}`);
                });
            } else {
                console.log('No Southampton fixtures found');
            }
        }
        
    } catch (error) {
        console.error('Error checking fixtures:', error.response?.data || error.message);
    }
}

checkSouthamptonUpcomingFACup();