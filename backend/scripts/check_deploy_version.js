/**
 * Check which version of normaliseFixture is running on Railway
 */

require('dotenv').config();
const axios = require('axios');

const BASE = process.env.SELF_BASE || 'https://virtuous-exploration-production.up.railway.app';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

async function checkVersion() {
  console.log('🔍 Triggering sync to see which version is deployed...\n');

  try {
    // Trigger a single fixture sync to force normaliseFixture to run
    const response = await axios.post(
      `${BASE}/api/sync/fixture/19441830`,
      {},
      {
        headers: { 'x-api-key': ADMIN_KEY },
        timeout: 30000
      }
    );

    console.log('✅ Single fixture sync result:', JSON.stringify(response.data, null, 2));
    console.log('\nIf you see team names (not "Home vs Away"), the fix is deployed.');
    console.log('If you see "Home vs Away", the old buggy code is still running.');

  } catch (error) {
    console.error('❌ Error:', error.response?.status);
    console.error('📄 Response:', JSON.stringify(error.response?.data, null, 2));
    console.error('📄 Message:', error.message);
  }
}

checkVersion();
