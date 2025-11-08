require('dotenv').config();
const axios = require('axios');

const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const SPORTMONKS_BASE = process.env.SPORTMONKS_BASE || 'https://api.sportmonks.com/v3/football';

async function testLiveEndpoints() {
    console.log('Testing various live match endpoints...\n');
    console.log('API Key:', SPORTMONKS_API_KEY ? `${SPORTMONKS_API_KEY.substring(0, 10)}...` : 'NOT FOUND');
    console.log('Base URL:', SPORTMONKS_BASE);
    console.log('');

    const endpoints = [
        '/livescores/inplay',
        '/livescores',
        '/fixtures/live',
        '/matches/live',
        '/livescores/latest'
    ];

    for (const endpoint of endpoints) {
        try {
            console.log(`Testing: ${SPORTMONKS_BASE}${endpoint}`);
            
            const response = await axios.get(`${SPORTMONKS_BASE}${endpoint}`, {
                params: {
                    api_token: SPORTMONKS_API_KEY,
                    include: 'events,participants,scores,periods,state'
                },
                timeout: 10000
            });

            console.log(`✅ ${endpoint} - Status: ${response.status}`);
            console.log(`   Data items: ${response.data?.data?.length || 0}`);
            
            if (response.data?.data?.length > 0) {
                console.log(`   First match ID: ${response.data.data[0]?.id || 'unknown'}`);
            }
            
        } catch (error) {
            console.log(`❌ ${endpoint} - Error: ${error.response?.status} ${error.response?.statusText}`);
            if (error.response?.data) {
                console.log(`   Error details:`, error.response.data);
            }
        }
        console.log('');
    }
}

testLiveEndpoints().catch(console.error);