/**
 * Manually trigger fixture sync for today
 */

require('dotenv').config();
const axios = require('axios');

const BASE = process.env.SELF_BASE || 'https://virtuous-exploration-production.up.railway.app';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

async function triggerFixtureSync() {
  console.log('🔄 Triggering fixture sync for today...\n');

  try {
    const today = new Date();
    const y = today.getUTCFullYear();
    const m = String(today.getUTCMonth() + 1).padStart(2, '0');
    const d = String(today.getUTCDate()).padStart(2, '0');

    console.log(`📅 Syncing fixtures for: ${y}-${m}-${d}`);
    console.log(`🔑 API Key: ${ADMIN_KEY ? '✅ Set' : '❌ Missing'}\n`);

    const response = await axios.post(
      `${BASE}/api/sync/date/${y}/${m}/${d}`,
      {},
      {
        headers: { 'x-api-key': ADMIN_KEY },
        timeout: 60000
      }
    );

    console.log('✅ Fixture sync completed!');
    console.log('📊 Results:', JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.response?.status, error.response?.statusText);
    if (error.response?.data) {
      console.error('📄 Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('📄 Message:', error.message);
    }
  }
}

triggerFixtureSync();
