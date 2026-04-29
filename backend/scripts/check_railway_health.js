#!/usr/bin/env node
/**
 * Check Railway Logs via API
 * Test if cron is starting on Railway
 */

require('dotenv').config();
const axios = require('axios');

async function checkRailwayHealth() {
  const BASE = process.env.SELF_BASE || 'http://localhost:8000';
  const ADMIN_KEY = process.env.ADMIN_API_KEY;
  
  console.log('🔍 Checking Railway Backend Status\n');
  console.log('BASE URL:', BASE);
  console.log('ADMIN_KEY:', ADMIN_KEY ? '✅ Set' : '❌ NOT SET\n');
  
  if (!ADMIN_KEY) {
    console.log('❌ ADMIN_API_KEY not set in environment');
    console.log('   This will prevent cron jobs from calling internal endpoints\n');
    process.exit(1);
  }
  
  try {
    // Check health
    console.log('1️⃣ Checking /health endpoint...');
    const health = await axios.get(`${BASE}/health`);
    console.log('✅ Backend is running:', health.data);
    console.log('');
    
    // Check cron status
    console.log('2️⃣ Checking /api/live/cron-status endpoint...');
    const cronStatus = await axios.get(`${BASE}/api/live/cron-status`, {
      headers: { 'x-api-key': ADMIN_KEY }
    });
    console.log('✅ Cron status response:', JSON.stringify(cronStatus.data, null, 2));
    console.log('');
    
    // Try manual sync
    console.log('3️⃣ Testing manual sync endpoint...');
    const syncTest = await axios.post(`${BASE}/api/sync/live-now`, {}, {
      headers: { 'x-api-key': ADMIN_KEY },
      timeout: 30000
    });
    console.log('✅ Manual sync successful:', syncTest.data);
    console.log('');
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response) {
      console.log('   Status:', error.response.status);
      console.log('   Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

checkRailwayHealth();
