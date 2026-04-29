// Collect tweets for match 19432238
require('dotenv').config();
const axios = require('axios');

async function collectTweets() {
  try {
    const matchId = 19432238;
    const apiUrl = process.env.API_URL || 'http://localhost:5001';
    
    console.log('🐦 Triggering tweet collection for match', matchId);
    console.log('API URL:', apiUrl);
    console.log('');

    const response = await axios.post(
      `${apiUrl}/api/tweets/collect/match/${matchId}`,
      {
        preMatchHours: 2,
        postMatchHours: 3,
        maxTweets: 100,
        queryType: 'Latest'
      }
    );

    console.log('✅ Tweet collection complete!');
    console.log(JSON.stringify(response.data, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
    
    if (error.response?.status === 404) {
      console.log('\n💡 The API server might not be running.');
      console.log('Try: npm start (in backend directory)');
    }
  }
}

collectTweets();
