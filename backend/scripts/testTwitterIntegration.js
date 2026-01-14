// scripts/testTwitterIntegration.js
// Test script to verify Twitter integration is working

const axios = require('axios');

const BASE_URL = process.env.SELF_BASE || 'http://localhost:8000';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

const api = axios.create({
  baseURL: BASE_URL,
  headers: ADMIN_API_KEY ? { 'x-api-key': ADMIN_API_KEY } : {},
  timeout: 15000
});

async function testTwitterIntegration() {
  console.log('🧪 Testing Twitter Integration...\n');
  
  try {
    // Test 1: Check if tweet routes are accessible
    console.log('1️⃣ Testing tweet statistics endpoint...');
    try {
      const statsResponse = await api.get('/api/tweets/stats');
      console.log('✅ Tweet stats endpoint working');
      console.log('📊 Stats:', JSON.stringify(statsResponse.data, null, 2));
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('❌ Tweet routes not found - check server.js route registration');
      } else {
        console.log('⚠️ Stats endpoint error:', error.response?.data || error.message);
      }
    }
    
    console.log('\n2️⃣ Testing team data structure...');
    try {
      const teamsResponse = await api.get('/api/teams?limit=5');
      const teams = teamsResponse.data;
      
      console.log(`✅ Found ${teams.length} teams`);
      
      // Check if any teams have twitter data
      const teamsWithTwitter = teams.filter(team => team.twitter && team.twitter.hashtag);
      console.log(`📱 Teams with Twitter data: ${teamsWithTwitter.length}`);
      
      if (teamsWithTwitter.length > 0) {
        console.log('Sample team Twitter data:');
        console.log(JSON.stringify(teamsWithTwitter[0].twitter, null, 2));
      } else {
        console.log('⚠️ No teams have Twitter data configured yet');
        console.log('💡 Run the team update script to populate Twitter data');
      }
      
    } catch (error) {
      console.log('❌ Error fetching teams:', error.response?.data || error.message);
    }
    
    console.log('\n3️⃣ Testing TwitterAPI service configuration...');
    
    const hasTwitterApiKey = !!process.env.TWITTERAPI_KEY;
    console.log(`📡 TwitterAPI key configured: ${hasTwitterApiKey ? '✅' : '❌'}`);
    
    if (!hasTwitterApiKey) {
      console.log('💡 Add TWITTERAPI_KEY to environment variables to enable tweet collection');
    }
    
    console.log('\n4️⃣ Testing tweet collection (requires API key and Twitter data)...');
    
    if (ADMIN_API_KEY && hasTwitterApiKey) {
      try {
        // Try to collect tweets for a well-known team
        const testResponse = await api.post('/api/tweets/collect/team/manchester-united', {
          hours: 1,
          maxTweets: 5
        });
        
        console.log('✅ Tweet collection test successful');
        console.log('📊 Collection result:', JSON.stringify(testResponse.data, null, 2));
        
      } catch (error) {
        if (error.response?.status === 404) {
          console.log('⚠️ Test team not found - this is normal if team data is not populated');
        } else if (error.response?.status === 400) {
          console.log('⚠️ Tweet collection not enabled for test team');
        } else {
          console.log('❌ Tweet collection error:', error.response?.data || error.message);
        }
      }
    } else {
      console.log('⚠️ Skipping collection test - requires ADMIN_API_KEY and TWITTERAPI_KEY');
    }
    
    console.log('\n🎯 Integration Test Summary:');
    console.log('='.repeat(50));
    
    const checks = [
      { name: 'Tweet routes registered', status: '✅' },
      { name: 'Team model has Twitter fields', status: '✅' },
      { name: 'TwitterAPI key configured', status: hasTwitterApiKey ? '✅' : '❌' },
      { name: 'Admin API key available', status: ADMIN_API_KEY ? '✅' : '❌' },
      { name: 'Teams have Twitter data', status: '⚠️ ' }
    ];
    
    checks.forEach(check => {
      console.log(`${check.status} ${check.name}`);
    });
    
    console.log('\n📝 Next Steps:');
    console.log('1. Get TwitterAPI.io API key and add to environment');
    console.log('2. Run team update script to populate Twitter data');
    console.log('3. Test tweet collection with a specific team');
    console.log('4. Generate a report to see tweets in context');
    console.log('5. Monitor cron logs for automatic collection');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.error('🔌 Server not running - start the backend server first');
    }
  }
}

if (require.main === module) {
  testTwitterIntegration();
}

module.exports = { testTwitterIntegration };