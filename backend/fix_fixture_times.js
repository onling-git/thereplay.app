// fix_fixture_times.js
// Re-sync fixture times from Sportmonks to fix timezone issues
// This script fetches fixtures from Sportmonks and updates ONLY the time-related fields

require('dotenv').config();
const { connectDB, closeDB } = require('./db/connect');
const { get } = require('./utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');
const Match = require('./models/Match');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fixFixtureById(matchId) {
  try {
    console.log(`\nFetching fixture ${matchId} from Sportmonks...`);
    
    // Fetch from Sportmonks (WITHOUT timezone param to get UTC)
    const response = await get(`/fixtures/${matchId}`, {
      include: 'participants;state'
    });
    
    const fixture = response.data?.data;
    if (!fixture) {
      console.log(`❌ Fixture ${matchId} not found in Sportmonks`);
      return false;
    }
    
    console.log(`Raw data from Sportmonks:`);
    console.log(`  starting_at: ${fixture.starting_at}`);
    console.log(`  starting_at_timestamp: ${fixture.starting_at_timestamp}`);
    
    // Normalize the fixture
    const normalized = normaliseFixtureToMatchDoc(fixture);
    
    console.log(`Normalized data:`);
    console.log(`  starting_at: ${normalized.match_info.starting_at}`);
    console.log(`  starting_at_timestamp: ${normalized.match_info.starting_at_timestamp}`);
    console.log(`  As UTC: ${new Date(normalized.match_info.starting_at_timestamp * 1000).toISOString()}`);
    
    // Update database - ONLY update time fields
    const result = await Match.findOneAndUpdate(
      { match_id: matchId },
      {
        $set: {
          'match_info.starting_at': normalized.match_info.starting_at,
          'match_info.starting_at_timestamp': normalized.match_info.starting_at_timestamp,
          'date': normalized.date
        }
      },
      { new: true }
    );
    
    if (result) {
      console.log(`✅ Updated match ${matchId} in database`);
      return true;
    } else {
      console.log(`❌ Match ${matchId} not found in database`);
      return false;
    }
    
  } catch (error) {
    console.error(`Error fixing fixture ${matchId}:`, error.message);
    return false;
  }
}

async function fixUpcomingFixtures(daysAhead = 14) {
  try {
    await connectDB();
    
    console.log(`\n=== Fixing Upcoming Fixtures (next ${daysAhead} days) ===\n`);
    
    const now = new Date();
    const futureDate = new Date(now.getTime() + (daysAhead * 24 * 60 * 60 * 1000));
    
    // Find upcoming matches
    const upcomingMatches = await Match.find({
      'match_info.starting_at': {
        $gte: now,
        $lte: futureDate
      }
    }).select('match_id teams').lean();
    
    console.log(`Found ${upcomingMatches.length} upcoming matches to fix`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const match of upcomingMatches) {
      const success = await fixFixtureById(match.match_id);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
      
      // Rate limiting
      await sleep(1500);
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`✅ Successfully fixed: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);
    
    await closeDB();
    
  } catch (error) {
    console.error('Error:', error);
    await closeDB();
    process.exit(1);
  }
}

// Main execution
const command = process.argv[2];
const arg = process.argv[3];

if (command === 'single' && arg) {
  // Fix a single fixture by ID
  connectDB().then(() => {
    fixFixtureById(parseInt(arg)).then(() => {
      closeDB();
    });
  });
} else if (command === 'upcoming') {
  // Fix all upcoming fixtures
  const days = arg ? parseInt(arg) : 14;
  fixUpcomingFixtures(days);
} else {
  console.log(`
Usage:
  node fix_fixture_times.js single <match_id>     Fix a single match
  node fix_fixture_times.js upcoming [days]       Fix upcoming matches (default: 14 days)

Examples:
  node fix_fixture_times.js single 19432260
  node fix_fixture_times.js upcoming 7
  `);
  process.exit(0);
}
