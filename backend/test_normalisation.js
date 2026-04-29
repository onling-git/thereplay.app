// Test normalisation of a real Sportmonks fixture
require('dotenv').config();
const { get } = require('./utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

async function testNormalisation() {
  try {
    const matchId = 19465300;
    
    console.log('🔍 Fetching and normalising fixture...\n');
    const include = 'events;participants;scores;state;lineups;comments';
    const { data } = await get(`/fixtures/${matchId}`, { include });
    
    const fixture = data?.data;
    if (!fixture) {
      console.log('❌ No fixture data returned');
      return;
    }
    
    console.log('✅ Fixture fetched:', fixture.name);
    console.log('State:', fixture.state?.name);
    
    // Log raw scores
    console.log('\n📊 Raw scores from API:');
    console.log(JSON.stringify(fixture.scores, null, 2));
    
    // Normalize the fixture
    console.log('\n🔄 Normalising fixture...');
    const normalized = normaliseFixtureToMatchDoc(fixture);
    
    if (!normalized) {
      console.log('❌ Normalisation returned null!');
      return;
    }
    
    console.log('\n✅ Normalised match data:');
    console.log('Match ID:', normalized.match_id);
    console.log('Home Team:', normalized.teams?.home?.team_name);
    console.log('Away Team:', normalized.teams?.away?.team_name);
    console.log('Score:', `${normalized.score?.home} - ${normalized.score?.away}`);
    console.log('Match Status:', normalized.match_status?.name);
    console.log('Events count:', normalized.events?.length || 0);
    console.log('Lineup home:', normalized.lineup?.home?.length || 0);
    console.log('Lineup away:', normalized.lineup?.away?.length || 0);
    console.log('Comments:', normalized.comments?.length || 0);
    
    // Check if score is correct
    if (normalized.score?.home === 0 && normalized.score?.away === 1) {
      console.log('\n✅ SCORE PARSING WORKS CORRECTLY!');
    } else {
      console.log('\n❌ SCORE PARSING FAILED!');
      console.log('Expected: 0-1, Got:', `${normalized.score?.home}-${normalized.score?.away}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

testNormalisation().catch(console.error);
