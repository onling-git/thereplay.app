// Test script to check if more statistics are available with different includes
require('dotenv').config();
const axios = require('axios');

async function testExtendedStatistics() {
  const matchId = 19432053;
  const apiToken = process.env.SPORTMONKS_API_KEY;
  
  console.log('🔍 Testing different include parameters for more statistics...\n');
  
  const includesToTest = [
    'statistics',
    'statistics.details',
    'statistics.type', 
    'participants;statistics.type',
    'detailedstatistics',
    'teamstatistics',
    'allstatistics',
    'stats',
    'detailed_stats'
  ];
  
  for (const include of includesToTest) {
    try {
      console.log(`Testing include: ${include}`);
      const response = await axios.get(`https://api.sportmonks.com/v3/football/fixtures/${matchId}`, {
        params: { api_token: apiToken, include }
      });
      
      const data = response.data?.data;
      const stats = data?.statistics;
      
      if (stats && stats.length > 0) {
        console.log(`  ✅ Found ${stats.length} statistics`);
        
        // Show unique type IDs
        const typeIds = [...new Set(stats.map(s => s.type_id))].sort((a,b) => a-b);
        console.log(`  📊 Type IDs: ${typeIds.join(', ')}`);
        
        if (stats.length > 12) {
          console.log(`  🎯 EXTENDED DATA FOUND!`);
          console.log(`  Sample extra stats:`);
          stats.slice(12, 16).forEach(stat => {
            console.log(`    Type ${stat.type_id}: ${stat.data?.value} (Participant: ${stat.participant_id})`);
          });
        }
      } else {
        console.log('  ❌ No statistics found');
      }
      
      // Check for other possible stat fields
      const otherFields = Object.keys(data || {}).filter(key => 
        key.toLowerCase().includes('stat') && key !== 'statistics'
      );
      if (otherFields.length > 0) {
        console.log(`  📋 Other stat fields: ${otherFields.join(', ')}`);
      }
      
    } catch (e) {
      console.log(`  ❌ Error: ${e.response?.status || e.message}`);
      if (e.response?.status === 422) {
        console.log(`    Invalid include parameter`);
      }
    }
    
    console.log(''); // Empty line for readability
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }
  
  console.log('🏁 Test completed');
}

testExtendedStatistics().catch(console.error);