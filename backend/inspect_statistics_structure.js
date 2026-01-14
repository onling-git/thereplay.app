// Inspect the actual structure of statistics data from SportMonks
require('dotenv').config();
const axios = require('axios');

async function inspectStatisticsStructure() {
  const matchId = 19432053; // Middlesbrough vs Southampton
  const apiToken = process.env.SPORTMONKS_API_KEY;
  
  try {
    console.log('🔍 Inspecting SportMonks statistics data structure...');
    
    const url = `https://api.sportmonks.com/v3/football/fixtures/${matchId}`;
    const response = await axios.get(url, {
      params: {
        api_token: apiToken,
        include: 'statistics;participants'
      }
    });
    
    const data = response.data?.data;
    
    if (data && data.statistics) {
      console.log('\n📊 STATISTICS DATA STRUCTURE:');
      console.log('================================');
      
      data.statistics.forEach((stat, i) => {
        console.log(`\nStatistic ${i + 1}:`);
        console.log('  Raw object:', JSON.stringify(stat, null, 2));
        
        // Check different possible property names
        console.log('  Possible values:');
        console.log(`    - stat.value: ${stat.value}`);
        console.log(`    - stat.data?.value: ${stat.data?.value}`);
        console.log(`    - stat.data: ${JSON.stringify(stat.data)}`);
        console.log(`    - stat.type: ${JSON.stringify(stat.type)}`);
        console.log(`    - stat.type_id: ${stat.type_id}`);
        console.log(`    - stat.participant_id: ${stat.participant_id}`);
      });
      
      console.log('\n📋 PARTICIPANTS DATA:');
      console.log('====================');
      data.participants.forEach(p => {
        console.log(`- ${p.name} (ID: ${p.id}, Location: ${p.meta?.location})`);
      });
      
    } else {
      console.log('❌ No statistics data found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.response?.status || error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

inspectStatisticsStructure().catch(console.error);