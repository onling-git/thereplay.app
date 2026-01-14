// Simple test to fetch match data with statistics from SportMonks API directly
require('dotenv').config();
const axios = require('axios');

async function testDirectSportMonksCall() {
  const matchId = 19432044;
  const apiToken = process.env.SPORTMONKS_API_KEY;
  
  if (!apiToken) {
    console.log('❌ No SPORTMONKS_API_KEY found');
    return;
  }
  
  console.log('🔍 Testing direct SportMonks API call with different includes...');
  
  const includesToTest = [
    'statistics;participants',
    'statistics;participants;state',
    'participants;statistics',
    'participants;state;statistics',
    'participants;state;statistics;scores'
  ];
  
  for (const include of includesToTest) {
    try {
      console.log(`\n📡 Testing include: ${include}`);
      
      const url = `https://api.sportmonks.com/v3/football/fixtures/${matchId}`;
      const response = await axios.get(url, {
        params: {
          api_token: apiToken,
          include: include
        }
      });
      
      const data = response.data?.data;
      
      if (data) {
        console.log('✅ Success!');
        console.log(`   - Has participants: ${data.participants ? 'Yes (' + data.participants.length + ')' : 'No'}`);
        console.log(`   - Has statistics: ${data.statistics ? 'Yes (' + data.statistics.length + ')' : 'No'}`);
        console.log(`   - Has state: ${data.state ? 'Yes' : 'No'}`);
        
        if (data.participants) {
          console.log('   - Participants:');
          data.participants.forEach(p => {
            console.log(`     * ${p.name} (ID: ${p.id}, Location: ${p.meta?.location || 'unknown'})`);
          });
        }
        
        if (data.statistics && data.statistics.length > 0) {
          console.log('   - Sample statistics:');
          data.statistics.slice(0, 5).forEach((stat, i) => {
            const typeName = stat.type?.name || stat.type?.code || 'Unknown';
            console.log(`     ${i + 1}. ${typeName}: ${stat.value} (Team: ${stat.participant_id})`);
          });
        }
        
        // If this worked well, we can stop testing others
        if (data.participants && data.statistics) {
          console.log('\n🎉 Found a working configuration!');
          break;
        }
      } else {
        console.log('❌ No data returned');
      }
      
    } catch (error) {
      console.log('❌ Error:', error.response?.status || error.message);
      if (error.response?.data) {
        console.log('   Details:', error.response.data);
      }
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

testDirectSportMonksCall().catch(console.error);