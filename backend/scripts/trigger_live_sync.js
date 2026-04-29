/**
 * trigger_live_sync.js
 * Manually trigger a live sync on Railway to test if cron is working
 * 
 * Usage:
 *   node scripts/trigger_live_sync.js
 */

require('dotenv').config();
const axios = require('axios');

const BASE = process.env.SELF_BASE || 'https://virtuous-exploration-production.up.railway.app';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

if (!ADMIN_KEY) {
  console.error('❌ ADMIN_API_KEY environment variable is required');
  process.exit(1);
}

async function triggerLiveSync() {
  console.log('🔄 Triggering live sync on Railway...');
  console.log('📍 Base URL:', BASE);
  console.log('🔑 API Key:', ADMIN_KEY ? '✅ Set' : '❌ Not set');
  console.log('');

  try {
    // Test health endpoint first
    console.log('1️⃣ Testing health endpoint...');
    const health = await axios.get(`${BASE}/health`, { timeout: 10000 });
    console.log('✅ Health check passed:', health.data);
    console.log('');

    // Trigger live sync
    console.log('2️⃣ Triggering live sync...');
    const startTime = Date.now();
    
    const response = await axios.post(
      `${BASE}/api/sync/live-now`,
      {},
      {
        headers: { 'x-api-key': ADMIN_KEY },
        timeout: 30000
      }
    );

    const elapsed = Date.now() - startTime;
    
    console.log('✅ Live sync completed!');
    console.log('⏱️  Time taken:', elapsed, 'ms');
    console.log('📊 Results:', JSON.stringify(response.data, null, 2));
    console.log('');

    if (response.data.foundLive === 0) {
      console.log('⚠️  No live matches found. This could mean:');
      console.log('   1. No matches are currently live');
      console.log('   2. Sportmonks API is not returning data');
      console.log('   3. Your plan may not include live scores');
    } else {
      console.log(`✅ Found ${response.data.foundLive} live matches`);
      console.log(`✅ Upserted ${response.data.upsertedCount} matches into database`);
    }

    // Check if we can get today's matches
    console.log('');
    console.log('3️⃣ Checking today\'s matches...');
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, '0');
    const d = String(today.getUTCDate()).padStart(2, '0');

    try {
      const dateSync = await axios.post(
        `${BASE}/api/sync/date/${y}/${m}/${d}`,
        {},
        {
          headers: { 'x-api-key': ADMIN_KEY },
          timeout: 30000
        }
      );

      console.log(`✅ Date sync (${y}-${m}-${d}) completed`);
      console.log(`📊 Total fetched: ${dateSync.data.totalFetched}, Upserted: ${dateSync.data.upsertedCount}`);
    } catch (err) {
      console.error('❌ Date sync failed:', err.response?.data || err.message);
    }

  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.error('📄 Response:', error.response.data);
    } else {
      console.error('📄 Message:', error.message);
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.error('');
      console.error('💡 Connection refused. Check:');
      console.error('   1. Is SELF_BASE set correctly?');
      console.error('   2. Is the Railway backend actually running?');
    }
    
    if (error.response?.status === 401) {
      console.error('');
      console.error('💡 Unauthorized. Check:');
      console.error('   1. Is ADMIN_API_KEY set correctly in Railway?');
      console.error('   2. Does it match the key in your .env?');
    }
    
    process.exit(1);
  }
}

triggerLiveSync();
