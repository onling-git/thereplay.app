// Test what Sportmonks API returns for a single fixture
require('dotenv').config();
const { get } = require('./utils/sportmonks');

async function testFixture() {
  const matchId = 19465300;
  
  console.log(`Fetching fixture ${matchId}...`);
  const response = await get(`/fixtures/${matchId}`, {
    include: 'events;participants;scores;state;lineups;comments'
  });
  
  const fixture = response.data?.data;
  if (!fixture) {
    console.log('No data returned');
    return;
  }
  
  console.log('\n📊 Fixture object keys:', Object.keys(fixture));
  console.log('\n🏆 League data:');
  console.log(JSON.stringify(fixture.league, null, 2));
  
  console.log('\n📅 Stage data:');
  console.log(JSON.stringify(fixture.stage, null, 2));
}

testFixture().catch(console.error);
