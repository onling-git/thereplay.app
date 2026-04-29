// Manually update match 19432244 with correct data from API
const mongoose = require('mongoose');
require('dotenv').config();
const { get: smGet } = require('./utils/sportmonks');
const Match = require('./models/Match');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

async function updateMatch19432244() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const matchId = 19432244;
    
    console.log(`🔄 Fetching and normalizing match ${matchId}...\n`);
    
    // Fetch from SportMonks
    const res = await smGet(`fixtures/${matchId}`, { 
      include: 'events;participants;scores;periods;state;lineups;statistics;comments' 
    });
    const matchData = res?.data?.data || res?.data;
    
    if (!matchData) {
      console.log('❌ Could not fetch match data');
      process.exit(1);
    }
    
    console.log('📊 Raw API data:');
    console.log('   Match ID:', matchData.id);
    console.log('   State:', matchData.state?.state || 'N/A', `(${matchData.state?.short_name || 'N/A'})`);
    
    // Normalize the fixture
    const normalized = normaliseFixtureToMatchDoc(matchData);
    
    if (!normalized) {
      console.log('❌ Normalization failed');
      process.exit(1);
    }
    
    console.log('\n✅ Normalized data:');
    console.log('   Match ID:', normalized.match_id);
    console.log('   Home:', normalized.teams?.home?.team_name);
    console.log('   Away:', normalized.teams?.away?.team_name);
    console.log('   Score:', `${normalized.score?.home || 0} - ${normalized.score?.away || 0}`);
    console.log('   Status:', normalized.match_status?.state, `(${normalized.match_status?.short_name})`);
    console.log('   Events:', normalized.events?.length || 0);
    console.log('   Comments:', normalized.comments?.length || 0);
    console.log('   Statistics home:', normalized.statistics?.home?.length || 0);
    console.log('   Statistics away:', normalized.statistics?.away?.length || 0);
    console.log('   Lineup home:', normalized.lineup?.home?.length || 0);
    console.log('   Lineup away:', normalized.lineup?.away?.length || 0);
    
    // Update in database
    console.log('\n🔄 Updating database...');
    const result = await Match.findOneAndUpdate(
      { match_id: normalized.match_id },
      { $set: normalized },
      { upsert: true, new: true }
    );
    
    console.log('✅ Database updated successfully!');
    console.log('\n📊 Verification:');
    console.log('   Match ID:', result.match_id);
    console.log('   Status:', result.match_status?.state);
    console.log('   Score:', `${result.score?.home || 0} - ${result.score?.away || 0}`);
    console.log('   Events:', result.events?.length || 0);
    console.log('   Comments:', result.comments?.length || 0);
    
  } catch (err) {
    console.error('❌ Error:', err.message || err);
    console.error(err.stack);
  } finally {
    await mongoose.disconnect();
  }
}

updateMatch19432244();
