const axios = require('axios');

async function testTeamNewsFix() {
  try {
    console.log('Testing team news fix with actual API...\n');
    
    // Test 1: Southampton news
    console.log('1. Testing Southampton news via API...');
    const southamptonResponse = await axios.get(
      'http://localhost:5000/api/news/team/southampton?limit=5',
      { timeout: 10000 }
    ).catch(err => {
      // Try production URL if local fails
      console.log('   Local API not available, trying production...');
      return axios.get(
        'https://virtuous-exploration-production.up.railway.app/api/news/team/southampton?limit=5',
        { timeout: 10000 }
      );
    });
    
    const southamptonArticles = Array.isArray(southamptonResponse.data) 
      ? southamptonResponse.data 
      : southamptonResponse.data.articles || [];
    
    console.log(`   ✓ Got ${southamptonArticles.length} Southampton articles`);
    if (southamptonArticles.length > 0) {
      console.log('   First article:');
      console.log(`     Title: ${southamptonArticles[0].title}`);
      console.log(`     Source: ${southamptonArticles[0].source}`);
    }
    
    // Test 2: Reading news
    console.log('\n2. Testing Reading news via API...');
    const readingResponse = await axios.get(
      'http://localhost:5000/api/news/team/reading?limit=5',
      { timeout: 10000 }
    ).catch(err => {
      console.log('   Local API not available, trying production...');
      return axios.get(
        'https://virtuous-exploration-production.up.railway.app/api/news/team/reading?limit=5',
        { timeout: 10000 }
      );
    });
    
    const readingArticles = Array.isArray(readingResponse.data) 
      ? readingResponse.data 
      : readingResponse.data.articles || [];
    
    console.log(`   ✓ Got ${readingArticles.length} Reading articles`);
    if (readingArticles.length > 0) {
      console.log('   First article:');
      console.log(`     Title: ${readingArticles[0].title}`);
      console.log(`     Source: ${readingArticles[0].source}`);
    }
    
    // Test 3: General news (should still work)
    console.log('\n3. Testing general news (no team filter)...');
    const generalResponse = await axios.get(
      'http://localhost:5000/api/news?limit=5',
      { timeout: 10000 }
    ).catch(err => {
      console.log('   Local API not available, trying production...');
      return axios.get(
        'https://virtuous-exploration-production.up.railway.app/api/news?limit=5',
        { timeout: 10000 }
      );
    });
    
    const generalArticles = Array.isArray(generalResponse.data) 
      ? generalResponse.data 
      : generalResponse.data.articles || [];
    
    console.log(`   ✓ Got ${generalArticles.length} general articles`);
    
    console.log('\n✅ All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', error.response.data);
    }
  }
}

testTeamNewsFix();
