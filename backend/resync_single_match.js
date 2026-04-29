// Resync a single match to populate league info
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const { get } = require('./utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

async function resyncMatch(matchId) {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    console.log(`\n🔄 Resyncing match ${matchId}...`);

    // Fetch from Sportmonks
    const response = await get(`/fixtures/${matchId}`, {
      include: 'league;stage;events;participants;scores;state;lineups;comments'
    });

    if (!response.data?.data) {
      throw new Error('No data returned from API');
    }

    const fixture = response.data.data;
    console.log(`📥 Fetched: ${fixture.name || 'Unknown match'}`);

    // Normalize the fixture
    const normalized = normaliseFixtureToMatchDoc(fixture);
    console.log(`✅ Normalized successfully`);
    console.log(`   League: ${normalized.match_info?.league?.name} (ID: ${normalized.match_info?.league?.id})`);

    // Update in database
    await Match.findOneAndUpdate(
      { match_id: matchId },
      normalized,
      { upsert: true, new: true }
    );

    console.log(`✅ Match ${matchId} updated successfully`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

const matchId = process.argv[2] || '19432260';
resyncMatch(matchId);
