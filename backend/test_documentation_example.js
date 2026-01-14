// Test SportMonks documentation example to see if more statistics are available
require('dotenv').config();
const axios = require('axios');

async function testDocumentationExample() {
  const apiToken = process.env.SPORTMONKS_API_KEY;
  
  console.log('Testing SportMonks documentation example (Celtic vs Rangers)...\n');
  
  try {
    // Test their exact example: Celtic vs Rangers (id: 18535517)
    const response = await axios.get('https://api.sportmonks.com/v3/football/fixtures/18535517', {
      params: { 
        api_token: apiToken, 
        include: 'statistics' 
      }
    });
    
    const data = response.data?.data;
    const stats = data?.statistics;
    
    if (stats && stats.length > 0) {
      console.log(`✅ Found ${stats.length} statistics in documentation example`);
      
      // Show unique type IDs
      const typeIds = [...new Set(stats.map(s => s.type_id))].sort((a,b) => a-b);
      console.log(`📊 Type IDs: ${typeIds.join(', ')}`);
      
      if (stats.length > 12) {
        console.log('🎯 More comprehensive data available in this match!');
        console.log('\nAll statistics found:');
        const statGroups = {};
        stats.forEach(stat => {
          if (!statGroups[stat.type_id]) statGroups[stat.type_id] = [];
          statGroups[stat.type_id].push(stat);
        });
        
        Object.keys(statGroups).sort((a,b) => a-b).forEach(typeId => {
          console.log(`  Type ${typeId}: ${statGroups[typeId].length} entries`);
        });
      } else {
        console.log('📋 Similar limited data as our match');
      }
      
      // Show match info
      console.log(`\nMatch: ${data.name || 'Unknown'}`);
      console.log(`League: ${data.league?.name || 'Unknown'}`);
      console.log(`Date: ${data.starting_at || 'Unknown'}`);
      
    } else {
      console.log('❌ No statistics found in documentation example');
    }
    
  } catch (e) {
    console.log(`❌ Error: ${e.response?.status || e.message}`);
    if (e.response?.data) {
      console.log('Details:', e.response.data);
    }
  }
}

testDocumentationExample().catch(console.error);