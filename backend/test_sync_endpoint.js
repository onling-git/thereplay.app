// Test calling the /api/sync/live-now endpoint directly
require('dotenv').config();
const axios = require('axios');

async function testSyncEndpoint() {
  const SELF_BASE = process.env.SELF_BASE || 'https://virtuous-exploration-production.up.railway.app';
  const ADMIN_API_KEY = process.env.ADMIN_API_KEY;
  
  console.log('🔧 Testing sync endpoint directly...\n');
  console.log(`   Base URL: ${SELF_BASE}`);
  console.log(`   Admin Key: ${ADMIN_API_KEY ? '***' + ADMIN_API_KEY.slice(-4) : 'MISSING'}\n`);
  
  if (!ADMIN_API_KEY) {
    console.error('❌ ADMIN_API_KEY not found in .env file!');
    console.error('   The cron job on Railway needs this to call the sync endpoint.\n');
    return;
  }
  
  try {
    console.log('📡 Calling /api/sync/live-now...');
    const startTime = Date.now();
    
    const response = await axios.post(
      `${SELF_BASE}/api/sync/live-now`,
      {},
      {
        headers: {
          'x-api-key': ADMIN_API_KEY
        },
        timeout: 30000
      }
    );
    
    const endTime = Date.now();
    console.log(`✅ Sync completed in ${endTime - startTime}ms\n`);
    
    console.log('📊 Response:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.updatedCount > 0) {
      console.log(`\n✅ SUCCESS: ${response.data.updatedCount} matches were updated!`);
      console.log('   The sync endpoint IS working. The issue is with the cron job on Railway.');
    } else {
      console.log('\n⚠️  Sync ran but updated 0 matches.');
      console.log('   This could mean:');
      console.log('   1. No live fixtures to update right now');
      console.log('   2. Fixtures are already up-to-date');
      console.log('   3. There\'s an issue with the sync logic');
    }
    
  } catch (err) {
    console.error('❌ Sync endpoint error:');
    if (err.response) {
      console.error(`   Status: ${err.response.status}`);
      console.error(`   Message:`, err.response.data);
      
      if (err.response.status === 401 || err.response.status === 403) {
        console.error('\n⚠️  Authentication failed!');
        console.error('   The ADMIN_API_KEY might be incorrect or the endpoint requires different auth.');
      }
    } else if (err.code === 'ECONNREFUSED') {
      console.error('   Connection refused - is the server running?');
    } else {
      console.error(`   Error: ${err.message}`);
    }
  }
}

testSyncEndpoint();
