#!/usr/bin/env node
/**
 * Sync Yesterday's Matches
 * Fetch and update all matches from yesterday
 */

require('dotenv').config();
const axios = require('axios');

async function syncYesterday() {
  const BASE = process.env.SELF_BASE || 'http://localhost:8000';
  const ADMIN_KEY = process.env.ADMIN_API_KEY;
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const year = yesterday.getFullYear();
  const month = yesterday.getMonth() + 1;
  const day = yesterday.getDate();
  
  console.log(`📅 Syncing matches from ${year}-${month}-${day}...\n`);
  
  try {
    const response = await axios.post(
      `${BASE}/api/sync/date/${year}/${month}/${day}`,
      {},
      {
        headers: { 'x-api-key': ADMIN_KEY },
        timeout: 60000
      }
    );
    
    console.log('✅ Sync successful!');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    if (error.response) {
      console.log('Status:', error.response.status);
      console.log('Data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

syncYesterday();
