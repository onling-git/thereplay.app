// Test score parsing from a real Sportmonks fixture
require('dotenv').config();
const { get } = require('./utils/sportmonks');

async function testScoreParsing() {
  try {
    // Fetch a match that should have finished
    const matchId = 19465300; // From the example data
    
    console.log('🔍 Fetching fixture data from Sportmonks...\n');
    const include = 'events;participants;scores;state;lineups;comments';
    const { data } = await get(`/fixtures/${matchId}`, { include });
    
    const fixture = data?.data;
    if (!fixture) {
      console.log('❌ No fixture data returned');
      return;
    }
    
    console.log('✅ Fixture fetched:', fixture.name);
    console.log('State:', fixture.state);
    console.log('\n📊 Scores structure:');
    console.log(JSON.stringify(fixture.scores, null, 2));
    
    console.log('\n👥 Participants:');
    const participants = fixture.participants?.data || fixture.participants || [];
    participants.forEach(p => {
      console.log(`  - ${p.name} (ID: ${p.id}, Location: ${p.meta?.location})`);
    });
    
    console.log('\n⚽ Events:');
    const events = fixture.events?.data || fixture.events || [];
    console.log(`  Found ${events.length} events`);
    if (events.length > 0) {
      events.slice(0, 3).forEach(e => {
        console.log(`  - Minute ${e.minute}: ${e.type?.name || e.type} - ${e.player_name || 'Unknown'}`);
      });
    }
    
    console.log('\n📋 Lineups:');
    const lineups = fixture.lineups?.data || fixture.lineups || [];
    console.log(`  Found ${lineups.length} lineup entries`);
    
    console.log('\n💬 Comments:');
    const comments = fixture.comments?.data || fixture.comments || [];
    console.log(`  Found ${comments.length} comments`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testScoreParsing().catch(console.error);
