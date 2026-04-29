// Check weekend matches (April 18-20, 2026)
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function main() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/thefinalplay');
    console.log('✅ Connected to MongoDB');

    // Weekend: April 18-20, 2026
    const weekendStart = new Date('2026-04-18T00:00:00Z');
    const weekendEnd = new Date('2026-04-20T23:59:59Z');

    console.log(`\n🔍 Looking for matches between ${weekendStart.toISOString()} and ${weekendEnd.toISOString()}\n`);

    const matches = await Match.find({
      date: { $gte: weekendStart, $lte: weekendEnd }
    }).sort({ date: 1 });

    console.log(`📊 Found ${matches.length} matches from the weekend\n`);

    if (matches.length === 0) {
      console.log('🚨 NO MATCHES FOUND FOR THE WEEKEND!');
      console.log('This means the sync process is not working properly.\n');
      
      // Check all matches in DB
      const allMatches = await Match.find({}).sort({ date: -1 }).limit(10);
      console.log('📋 Most recent matches in database:');
      allMatches.forEach(m => {
        console.log(`   ${m.match_id}: ${m.teams?.home?.team_name || 'Unknown'} vs ${m.teams?.away?.team_name || 'Unknown'} - ${new Date(m.date).toISOString()}`);
      });
    } else {
      matches.forEach((match, i) => {
        console.log(`${i + 1}. Match ID: ${match.match_id}`);
        console.log(`   Teams: ${match.teams?.home?.team_name || 'Unknown'} vs ${match.teams?.away?.team_name || 'Unknown'}`);
        console.log(`   Date: ${new Date(match.date).toISOString()}`);
        console.log(`   Score: ${match.score?.home || 0} - ${match.score?.away || 0}`);
        console.log(`   Status: ${match.match_status?.name || match.status || 'Unknown'}`);
        console.log(`   Events: ${match.events?.length || 0} events`);
        console.log(`   Has lineup: ${!!match.lineup && (match.lineup.home?.length > 0 || match.lineup.away?.length > 0)}`);
        console.log(`   Has commentary: ${!!match.commentary && match.commentary.length > 0}`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

main().catch(console.error);
