require('dotenv').config();
const axios = require('axios');

const BASE = process.env.SELF_BASE || 'http://localhost:8000';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

async function collectSouthamptonTweets() {
  try {
    console.log('🐦 Collecting tweets for Southampton...');
    
    const response = await axios.post(
      `${BASE}/api/tweets/collect/team/southampton`,
      {
        hours: 24,
        maxTweets: 50,
        queryType: 'Latest'
      },
      {
        headers: {
          'x-api-key': ADMIN_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Collection complete!');
    console.log(JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

collectSouthamptonTweets();
