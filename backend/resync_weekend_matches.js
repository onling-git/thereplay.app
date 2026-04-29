// Re-sync weekend matches (April 18-20, 2026) to fix the scores
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const { get } = require('./utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function resyncWeekendMatches() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    // Get all matches from April 18-20
    const weekendStart = new Date('2026-04-18T00:00:00Z');
    const weekendEnd = new Date('2026-04-20T23:59:59Z');

    const matches = await Match.find({
      'match_info.starting_at': { $gte: weekendStart, $lte: weekendEnd }
    }).lean();

    console.log(`📊 Found ${matches.length} matches to re-sync\n`);

    let updated = 0;
    let errors = 0;
    let skipped = 0;

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const matchId = match.match_id;
      
      try {
        console.log(`[${i + 1}/${matches.length}] Re-syncing match ${matchId}...`);
        
        // Fetch fresh data from Sportmonks
        const include = 'events;participants;scores;state;lineups;statistics.type;comments';
        const { data } = await get(`/fixtures/${matchId}`, { include });
        
        const fixture = data?.data;
        if (!fixture) {
          console.log(`  ⚠️  No data returned from API`);
          skipped++;
          continue;
        }
        
        // Normalise the fixture
        const doc = normaliseFixtureToMatchDoc(fixture);
        if (!doc) {
          console.log(`  ⚠️  Normalisation failed`);
          skipped++;
          continue;
        }
        
        // Update the match - delete and recreate to avoid schema conflicts
        await Match.deleteOne({ match_id: matchId });
        await Match.create(doc);
        
        console.log(`  ✅ Updated: ${doc.teams?.home?.team_name} ${doc.score?.home}-${doc.score?.away} ${doc.teams?.away?.team_name}`);
        updated++;
        
        // Rate limit: delay between requests
        if (i < matches.length - 1) {
          await sleep(200); // 200ms delay
        }
        
      } catch (error) {
        console.error(`  ❌ Error syncing match ${matchId}:`, error.message);
        errors++;
        
        // Continue with delay even on error
        if (i < matches.length - 1) {
          await sleep(500); // Longer delay after error
        }
      }
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`  ✅ Updated: ${updated}`);
    console.log(`  ⚠️  Skipped: ${skipped}`);
    console.log(`  ❌ Errors: ${errors}`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n👋 Disconnected from MongoDB');
  }
}

resyncWeekendMatches().catch(console.error);
