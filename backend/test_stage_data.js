require('dotenv').config();
const { get } = require('./utils/sportmonks');

async function testStageData() {
  try {
    console.log('🔍 Testing stage data fetch for match 19631550...\n');
    
    const matchId = 19631550;
    const response = await get(`fixtures/${matchId}`, {
      include: 'stage;participants'
    });

    const fixture = response.data?.data;
    if (!fixture) {
      console.log('❌ No fixture data found');
      return;
    }

    console.log('=== STAGE INFORMATION ===');
    console.log('Raw stage data:', JSON.stringify(fixture.stage, null, 2));
    
    // Check if stage has nested data property
    const stageObj = fixture.stage?.data || fixture.stage;
    console.log('\nProcessed stage object:', JSON.stringify(stageObj, null, 2));
    
    console.log('\n=== LEAGUE INFORMATION ===');
    console.log('League:', JSON.stringify(fixture.league, null, 2));
    
    console.log('\n=== SEASON INFORMATION ===');
    console.log('Season:', JSON.stringify(fixture.season, null, 2));
    
    // If stage info is still missing, check what else is available
    console.log('\n=== ALL AVAILABLE KEYS ===');
    console.log('Fixture keys:', Object.keys(fixture));
    
  } catch (error) {
    console.error('Error fetching stage data:', error.message);
  }
}

testStageData();