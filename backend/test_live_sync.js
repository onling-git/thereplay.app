// Test the live sync endpoint manually
require('dotenv').config();
const axios = require('axios');

// Force localhost for testing (ignore SELF_BASE for now)
const BASE = 'http://localhost:3001';
const ADMIN_KEY = process.env.ADMIN_API_KEY || process.env.ADMIN_KEY;

async function testLiveSync() {
  try {
    console.log('🔄 Testing live sync endpoint...\n');
    console.log('   Base URL:', BASE);
    console.log('   Using admin key:', ADMIN_KEY ? '✅ Found' : '❌ Missing');
    console.log('');
    
    const response = await axios.post(
      `${BASE}/api/sync/live-now`,
      {},
      {
        headers: {
          'x-api-key': ADMIN_KEY
        },
        timeout: 30000
      }
    );
    
    console.log('✅ Live sync completed!\n');
    console.log('📊 Results:');
    console.log('   Found live fixtures:', response.data.foundLive);
    console.log('   Upserted matches:', response.data.upsertedCount);
    console.log('   Match IDs:', response.data.match_ids);
    console.log('');
    
    if (response.data.match_ids && response.data.match_ids.includes(19432244)) {
      console.log('✅ Match 19432244 was included in the sync!');
    } else {
      console.log('⚠️ Match 19432244 was NOT in the live sync results');
    }
    
  } catch (err) {
    console.error('❌ Error testing live sync:');
    if (err.response) {
      console.error('   Status:', err.response.status);
      console.error('   Data:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error('   Message:', err.message);
    }
  }
}

testLiveSync();
