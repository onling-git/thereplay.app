// Test script to diagnose Twitter API connectivity
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const axios = require('axios');

const TWITTER_API_KEY = process.env.TWITTERAPI_KEY;
const TWITTER_BASE_URL = 'https://api.twitterapi.io';

console.log('🔍 Twitter API Diagnostic Test\n');
console.log('='.repeat(80));
console.log('Configuration:');
console.log('   Base URL:', TWITTER_BASE_URL);
console.log('   API Key:', TWITTER_API_KEY ? `${TWITTER_API_KEY.substring(0, 10)}...${TWITTER_API_KEY.substring(TWITTER_API_KEY.length - 4)}` : 'NOT SET');
console.log('   Key length:', TWITTER_API_KEY ? TWITTER_API_KEY.length : 0);
console.log('='.repeat(80));
console.log('');

async function testTwitterAPI() {
  if (!TWITTER_API_KEY) {
    console.error('❌ TWITTERAPI_KEY is not set in environment variables');
    process.exit(1);
  }

  // Test 1: Simple search query
  console.log('Test 1: Simple hashtag search...');
  try {
    const response = await axios.get(`${TWITTER_BASE_URL}/twitter/tweet/advanced_search`, {
      headers: {
        'X-API-Key': TWITTER_API_KEY,
        'Content-Type': 'application/json'
      },
      params: {
        query: '#football since:2026-04-18 until:2026-04-19',
        queryType: 'Latest',
        cursor: ''
      },
      timeout: 10000
    });

    console.log('✅ SUCCESS!');
    console.log('   Status:', response.status);
    console.log('   Tweets found:', response.data?.tweets?.length || 0);
    console.log('   Has next page:', response.data?.has_next_page || false);
    
    if (response.data?.tweets?.length > 0) {
      const firstTweet = response.data.tweets[0];
      console.log('\n   Sample tweet:');
      console.log('   - Author:', firstTweet.author?.userName || 'unknown');
      console.log('   - Text:', firstTweet.text?.substring(0, 60) + '...');
      console.log('   - Created:', firstTweet.createdAt);
    }
    
  } catch (error) {
    console.error('❌ FAILED');
    console.error('   Status:', error.response?.status);
    console.error('   Error:', error.response?.data || error.message);
    console.error('\n   Full error details:', JSON.stringify(error.response?.data, null, 2));
    
    if (error.response?.status === 401) {
      console.error('\n⚠️  401 Unauthorized - Possible causes:');
      console.error('   1. API key is invalid or expired');
      console.error('   2. API key format is incorrect');
      console.error('   3. Authentication method has changed');
      console.error('   4. Account has been suspended or needs payment');
      console.error('\n   💡 Next steps:');
      console.error('   - Check your TwitterAPI.io dashboard: https://twitterapi.io/dashboard');
      console.error('   - Verify your API key is correct');
      console.error('   - Check if your plan has expired or needs renewal');
      console.error('   - Review TwitterAPI.io documentation for auth changes');
    }
    
    process.exit(1);
  }

  console.log('\n' + '='.repeat(80));
  console.log('Test 2: User-specific search...');
  try {
    const response = await axios.get(`${TWITTER_BASE_URL}/twitter/tweet/advanced_search`, {
      headers: {
        'X-API-Key': TWITTER_API_KEY,
        'Content-Type': 'application/json'
      },
      params: {
        query: 'from:BBCSport since:2026-04-18 until:2026-04-19',
        queryType: 'Latest',
        cursor: ''
      },
      timeout: 10000
    });

    console.log('✅ SUCCESS!');
    console.log('   Status:', response.status);
    console.log('   Tweets found:', response.data?.tweets?.length || 0);
    
  } catch (error) {
    console.error('❌ FAILED');
    console.error('   Status:', error.response?.status);
    console.error('   Error:', error.response?.data || error.message);
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Diagnostic complete');
  console.log('');
}

testTwitterAPI().catch(error => {
  console.error('\nFatal error:', error);
  process.exit(1);
});
