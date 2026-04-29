// Test what /livescores/inplay returns
const { get: smGet } = require('./utils/sportmonks');

async function testInplayEndpoint() {
  try {
    console.log('🔄 Fetching /livescores/inplay...\n');
    
    const { data } = await smGet('/livescores/inplay', { 
      include: 'state;participants;scores' 
    });
    
    const fixtures = Array.isArray(data?.data) ? data.data : [];
    
    console.log(`📊 Found ${fixtures.length} in-play fixtures\n`);
    
    if (fixtures.length === 0) {
      console.log('⚠️ No fixtures returned by /livescores/inplay');
      console.log('\nLet\'s try /livescores/all instead...\n');
      
      const { data: allData } = await smGet('/livescores/all', { 
        include: 'state;participants;scores',
        limit: 20
      });
      
      const allFixtures = Array.isArray(allData?.data) ? allData.data : [];
      console.log(`📊 Found ${allFixtures.length} fixtures from /livescores/all\n`);
      
      allFixtures.forEach(fx => {
        console.log(`   Match ${fx.id}:`);
        console.log(`      State: ${fx.state?.state || 'N/A'} (${fx.state?.short_name || 'N/A'})`);
        console.log(`      Name: ${fx.name || 'N/A'}`);
        console.log(`      Starting: ${fx.starting_at || 'N/A'}`);
        console.log('');
      });
      
      // Check if our match is in the all list
      const ourMatch = allFixtures.find(f => f.id === 19432244);
      if (ourMatch) {
        console.log('✅ Match 19432244 found in /livescores/all');
        console.log('   State:', ourMatch.state?.state, `(${ourMatch.state?.short_name})`);
      } else {
        console.log('❌ Match 19432244 NOT in /livescores/all');
      }
    } else {
      fixtures.forEach(fx => {
        console.log(`Match ${fx.id}:`);
        console.log(`   State: ${fx.state?.state || 'N/A'} (${fx.state?.short_name || 'N/A'})`);
        console.log(`   Name: ${fx.name || 'N/A'}`);
        console.log('');
      });
      
      // Check if our match is in the inplay list
      const ourMatch = fixtures.find(f => f.id === 19432244);
      if (ourMatch) {
        console.log('✅ Match 19432244 found in /livescores/inplay');
      } else {
        console.log('⚠️ Match 19432244 NOT in /livescores/inplay (might be at HT)');
      }
    }
    
  } catch (err) {
    console.error('❌ Error:', err.message || err);
  }
}

testInplayEndpoint();
