// Direct test: Can we fetch from SportMonks /livescores/inplay right now?
require('dotenv').config();
const { get: smGet } = require('./utils/sportmonks');

async function testLiveScoresAPI() {
  console.log('🔍 Testing SportMonks /livescores/inplay endpoint...\n');
  
  try {
    const startTime = Date.now();
    const { data } = await smGet('/livescores/inplay', { 
      include: 'events;participants;scores;periods;state;lineups;statistics.type;comments'
    });
    const endTime = Date.now();
    
    console.log(`✅ API responded in ${endTime - startTime}ms\n`);
    
    const fixtures = Array.isArray(data?.data) ? data.data : [];
    
    console.log(`📊 Results:`);
    console.log(`   Total fixtures returned: ${fixtures.length}\n`);
    
    if (fixtures.length === 0) {
      console.log('⚠️  NO LIVE FIXTURES - This is why nothing is updating!');
      console.log('   Possible reasons:');
      console.log('   1. No matches are currently live');
      console.log('   2. API is not returning data correctly');
      console.log('   3. Your plan doesn\'t include livescores endpoint\n');
      
      // Try /livescores/all as alternative
      console.log('🔄 Trying /livescores/all instead...\n');
      const { data: allData } = await smGet('/livescores/all', { include: 'state;participants' });
      const allFixtures = Array.isArray(allData?.data) ? allData.data : [];
      console.log(`   Found ${allFixtures.length} fixtures from /livescores/all`);
      
      if (allFixtures.length > 0) {
        console.log('\n   States of fixtures:');
        allFixtures.slice(0, 10).forEach(f => {
          console.log(`      ${f.id}: ${f.state?.state || f.state?.short_name} - ${f.name}`);
        });
      }
    } else {
      console.log('✅ Live fixtures found:\n');
      fixtures.forEach(f => {
        console.log(`   Match ${f.id}:`);
        console.log(`      State: ${f.state?.state} (${f.state?.short_name})`);
        console.log(`      Name: ${f.name || 'N/A'}`);
        console.log(`      Has events: ${f.events?.data?.length || f.events?.length || 0}`);
        console.log(`      Has comments: ${f.comments?.data?.length || f.comments?.length || 0}`);
        console.log(`      Has statistics: ${f.statistics?.data?.length || f.statistics?.length || 0}`);
        console.log('');
      });
    }
    
  } catch (err) {
    console.error('❌ API Error:');
    if (err.response) {
      console.error(`   Status: ${err.response.status}`);
      console.error(`   Data:`, JSON.stringify(err.response.data, null, 2));
      
      if (err.response.status === 429) {
        console.error('\n⚠️  RATE LIMIT HIT - You\'ve exceeded your API quota!');
        console.error('   This would prevent live updates until the limit resets.');
      }
    } else {
      console.error(`   Message: ${err.message}`);
    }
  }
}

testLiveScoresAPI();
