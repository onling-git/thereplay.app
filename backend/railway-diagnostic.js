// Diagnostic script to check Railway environment and cron status
require('dotenv').config();

console.log('='.repeat(60));
console.log('RAILWAY DIAGNOSTIC CHECK');
console.log('='.repeat(60));
console.log('\n📋 Environment Variables:');
console.log('   SELF_BASE:', process.env.SELF_BASE || '❌ NOT SET');
console.log('   ADMIN_API_KEY:', process.env.ADMIN_API_KEY ? '✅ Set' : '❌ NOT SET');
console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ NOT SET');
console.log('   SPORTMONKS_API_KEY:', process.env.SPORTMONKS_API_KEY ? '✅ Set' : '❌ NOT SET');
console.log('   NODE_ENV:', process.env.NODE_ENV || 'not set');
console.log('   PORT:', process.env.PORT || '3001');

console.log('\n⏰ Current Time:', new Date().toISOString());
console.log('   Local Time:', new Date().toString());

console.log('\n🔍 Checking if server is reachable...');
const axios = require('axios');
const BASE = process.env.SELF_BASE || 'http://localhost:3001';

async function checkServer() {
  try {
    // Check if server responds
    const response = await axios.get(`${BASE}/health`, { timeout: 5000 }).catch(() => null);
    if (response && response.status === 200) {
      console.log('   ✅ Server is responding');
    } else {
      console.log('   ⚠️ Server not responding or no /health endpoint');
    }
  } catch (e) {
    console.log('   ❌ Cannot reach server:', e.message);
  }
  
  // Check sync endpoint
  try {
    if (!process.env.ADMIN_API_KEY) {
      console.log('   ⚠️ Cannot test sync endpoint - ADMIN_API_KEY not set');
      return;
    }
    
    console.log('\n🔄 Testing live-now sync endpoint...');
    const response = await axios.post(
      `${BASE}/api/sync/live-now`,
      {},
      {
        headers: { 'x-api-key': process.env.ADMIN_API_KEY },
        timeout: 30000
      }
    );
    
    console.log('   ✅ Sync endpoint works!');
    console.log('   Response:', JSON.stringify(response.data, null, 2));
  } catch (e) {
    console.log('   ❌ Sync endpoint failed:', e.response?.status, e.response?.data || e.message);
  }
}

checkServer().then(() => {
  console.log('\n' + '='.repeat(60));
  console.log('IMPORTANT FOR RAILWAY:');
  console.log('Make sure these environment variables are set in Railway dashboard:');
  console.log('  - SELF_BASE (should be your Railway app URL)'); 
  console.log('  - ADMIN_API_KEY');
  console.log('  - MONGODB_URI');
  console.log('  - SPORTMONKS_API_KEY');
  console.log('='.repeat(60));
  process.exit(0);
});
