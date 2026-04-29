// test_fixture_timezone.js
// Test script to diagnose timezone issues with fixture times

require('dotenv').config();
const { get } = require('./utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

async function testFixtureById(fixtureId) {
  console.log(`\n=== Testing Fixture ID: ${fixtureId} ===\n`);
  
  try {
    // Fetch fixture WITHOUT timezone parameter (should be UTC)
    console.log('1. Fetching fixture WITHOUT timezone parameter:');
    const response1 = await get(`/fixtures/${fixtureId}`, {
      include: 'events;participants;scores;periods;state;lineups;statistics.type;comments'
    });
    
    const fixture1 = response1.data?.data;
    if (fixture1) {
      console.log('   Raw starting_at:', fixture1.starting_at);
      console.log('   Raw starting_at_timestamp:', fixture1.starting_at_timestamp);
      
      // Normalize and see what we get
      const normalized1 = normaliseFixtureToMatchDoc(fixture1);
      console.log('   Normalized starting_at:', normalized1.match_info.starting_at);
      console.log('   Normalized starting_at_timestamp:', normalized1.match_info.starting_at_timestamp);
      console.log('   As JS Date:', new Date(normalized1.match_info.starting_at_timestamp * 1000).toISOString());
    }
    
    // Fetch fixture WITH timezone parameter (Europe/London)
    console.log('\n2. Fetching fixture WITH timezone=Europe/London:');
    const response2 = await get(`/fixtures/${fixtureId}`, {
      include: 'events;participants;scores;periods;state;lineups;statistics.type;comments',
      timezone: 'Europe/London'
    });
    
    const fixture2 = response2.data?.data;
    if (fixture2) {
      console.log('   Raw starting_at:', fixture2.starting_at);
      console.log('   Raw starting_at_timestamp:', fixture2.starting_at_timestamp);
      
      // Normalize and see what we get
      const normalized2 = normaliseFixtureToMatchDoc(fixture2);
      console.log('   Normalized starting_at:', normalized2.match_info.starting_at);
      console.log('   Normalized starting_at_timestamp:', normalized2.match_info.starting_at_timestamp);
      console.log('   As JS Date:', new Date(normalized2.match_info.starting_at_timestamp * 1000).toISOString());
    }
    
    // Compare
    console.log('\n3. Comparison:');
    if (fixture1 && fixture2) {
      console.log('   starting_at matches:', fixture1.starting_at === fixture2.starting_at);
      console.log('   starting_at_timestamp matches:', fixture1.starting_at_timestamp === fixture2.starting_at_timestamp);
      
      if (fixture1.starting_at !== fixture2.starting_at) {
        console.log('   ⚠️  WARNING: starting_at differs based on timezone parameter!');
        console.log('   ⚠️  This means starting_at is NOT always in UTC!');
      }
      
      if (fixture1.starting_at_timestamp !== fixture2.starting_at_timestamp) {
        console.log('   ⚠️  WARNING: starting_at_timestamp differs based on timezone parameter!');
        console.log('   ⚠️  This should NOT happen - timestamps should always be UTC!');
      }
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Test with the fixture the user mentioned
const fixtureId = process.argv[2] || 19432260;
testFixtureById(fixtureId);
