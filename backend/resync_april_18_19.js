// Resync all matches between April 18-19, 2026 to populate league info
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const { get } = require('./utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

async function resyncApril1819() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    // April 18-19, 2026 in UTC timestamps
    const startDate = new Date('2026-04-18T00:00:00Z');
    const endDate = new Date('2026-04-20T00:00:00Z'); // End of April 19

    const startTimestamp = Math.floor(startDate.getTime() / 1000);
    const endTimestamp = Math.floor(endDate.getTime() / 1000);

    console.log(`📅 Finding matches between:`);
    console.log(`   ${startDate.toISOString()}`);
    console.log(`   ${endDate.toISOString()}`);
    console.log(`   Timestamps: ${startTimestamp} - ${endTimestamp}\n`);

    // Find all matches in this date range
    const matches = await Match.find({
      'match_info.starting_at_timestamp': {
        $gte: startTimestamp,
        $lt: endTimestamp
      }
    }).select('match_id teams.home.team_name teams.away.team_name match_info.league.id').lean();

    console.log(`📊 Found ${matches.length} matches to resync\n`);

    if (matches.length === 0) {
      console.log('❌ No matches found in this date range');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const matchId = match.match_id;
      const hasLeagueId = match.match_info?.league?.id;

      try {
        console.log(`\n[${i + 1}/${matches.length}] Match ${matchId}`);
        console.log(`   ${match.teams?.home?.team_name || 'Home'} vs ${match.teams?.away?.team_name || 'Away'}`);
        console.log(`   Current league ID: ${hasLeagueId || 'MISSING'}`);

        // Fetch from Sportmonks
        console.log(`   📥 Fetching from API...`);
        const response = await get(`/fixtures/${matchId}`, {
          include: 'league;stage;events;participants;scores;state;lineups;comments'
        });

        if (!response.data?.data) {
          throw new Error('No data returned from API');
        }

        const fixture = response.data.data;
        
        // Normalize the fixture
        const normalized = normaliseFixtureToMatchDoc(fixture);
        
        const newLeagueId = normalized.match_info?.league?.id;
        const newLeagueName = normalized.match_info?.league?.name;

        console.log(`   ✅ Normalized - League: ${newLeagueName} (ID: ${newLeagueId})`);
        console.log(`   💾 Updating database...`);

        // Update in database
        await Match.findOneAndUpdate(
          { match_id: matchId },
          normalized,
          { new: true }
        );

        console.log(`   ✅ Updated successfully`);
        successCount++;

        // Rate limiting - wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        errorCount++;
        errors.push({ matchId, error: error.message });
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('📊 Resync Summary:');
    console.log(`   Total matches: ${matches.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    
    if (errors.length > 0) {
      console.log('\n❌ Errors:');
      errors.forEach(({ matchId, error }) => {
        console.log(`   Match ${matchId}: ${error}`);
      });
    }

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

resyncApril1819();
