// Wait 30 seconds then test sync endpoint again
require('dotenv').config();
const axios = require('axios');

async function testAfterDeploy() {
  const SELF_BASE = process.env.SELF_BASE || 'https://virtuous-exploration-production.up.railway.app';
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
  
  console.log('🚀 Testing /api/sync/live-now with 30s timeout...\n');
  
  try {
    const startTime = Date.now();
    const response = await axios.post(
      `${SELF_BASE}/api/sync/live-now`,
      {},
      {
        headers: { 'x-api-key': ADMIN_API_KEY },
        timeout: 30000
      }
    );
    const duration = Date.now() - startTime;
    
    console.log(`✅ SUCCESS! Sync endpoint responded in ${duration}ms\n`);
    console.log('Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.updatedCount > 0) {
      console.log(`\n🎉 ${response.data.updatedCount} matches were updated!`);
      console.log('   The cron job should now work automatically!');
    }
    
  } catch (err) {
    if (err.response) {
      console.error(`❌ Status ${err.response.status}:`, err.response.data);
    } else if (err.code === 'ECONNABORTED') {
      console.error('❌ Request timed out after 30 seconds');
      console.error('   Railway might still be deploying. Wait 2-3 minutes and try again.');
    } else {
      console.error('❌ Error:', err.message);
    }
  }
}

testAfterDeploy();
