// Quick test: Is Railway app responding at all?
require('dotenv').config();
const axios = require('axios');

async function testRailwayApp() {
  const SELF_BASE = process.env.SELF_BASE || 'https://virtuous-exploration-production.up.railway.app';
  
  console.log('🔍 Testing Railway app health...\n');
  console.log(`   URL: ${SELF_BASE}\n`);
  
  // Test 1: Root endpoint
  console.log('1️⃣ Testing root endpoint (/)...');
  try {
    const { data, status } = await axios.get(`${SELF_BASE}/`, { timeout: 5000 });
    console.log(`   ✅ Status ${status}: ${typeof data === 'string' ? data.substring(0, 100) : JSON.stringify(data).substring(0, 100)}\n`);
  } catch (err) {
    if (err.response) {
      console.log(`   ⚠️  Status ${err.response.status}: ${JSON.stringify(err.response.data).substring(0, 100)}\n`);
    } else {
      console.log(`   ❌ ${err.message}\n`);
    }
  }
  
  // Test 2: API endpoint
  console.log('2️⃣ Testing /api/teams endpoint...');
  try {
    const { data, status } = await axios.get(`${SELF_BASE}/api/teams`, { timeout: 5000 });
    console.log(`   ✅ Status ${status}: Found ${Array.isArray(data) ? data.length : 'N/A'} teams\n`);
  } catch (err) {
    if (err.response) {
      console.log(`   ⚠️  Status ${err.response.status}: ${JSON.stringify(err.response.data).substring(0, 100)}\n`);
    } else {
      console.log(`   ❌ ${err.message}\n`);
    }
  }
  
  // Test 3: Sync endpoint
  console.log('3️⃣ Testing /api/sync/live-now endpoint...');
  try {
    const { data, status } = await axios.post(
      `${SELF_BASE}/api/sync/live-now`,
      {},
      {
        headers: { 'x-api-key': process.env.ADMIN_API_KEY },
        timeout: 5000
      }
    );
    console.log(`   ✅ Status ${status}: ${JSON.stringify(data).substring(0, 100)}\n`);
  } catch (err) {
    if (err.response) {
      console.log(`   ⚠️  Status ${err.response.status}: ${JSON.stringify(err.response.data)}\n`);
    } else {
      console.log(`   ❌ ${err.message}\n`);
    }
  }
  
  console.log('💡 Next steps:');
  console.log('   - If all fail: Railway app is down/crashed');
  console.log('   - If only sync fails: Route registration issue');
  console.log('   - Check Railway logs: Project → Deployments → View Logs');
}

testRailwayApp();
