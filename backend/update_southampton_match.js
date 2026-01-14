// Update database with real Southampton vs Millwall match data
require('dotenv').config();
const { fetchMatchById, transformToMatchSchema, updateDatabaseWithRealMatch } = require('./fetch_match_by_id');
const mongoose = require('mongoose');

async function main() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/thefinalplay');
    console.log('✅ Connected to MongoDB');

    // Fetch the real match data
    console.log('🔄 Fetching real Southampton vs Millwall match data...');
    const rawMatchData = await fetchMatchById(19432044);
    
    if (!rawMatchData) {
      throw new Error('Failed to fetch match data');
    }

    // Transform to our schema format
    const transformedData = transformToMatchSchema(rawMatchData);
    
    if (!transformedData) {
      throw new Error('Failed to transform match data');
    }

    // Update database
    console.log('\n💾 Updating database with real match data...');
    const updatedMatch = await updateDatabaseWithRealMatch(transformedData);

    if (updatedMatch) {
      console.log('\n🎉 SUCCESS! Database updated with real Southampton vs Millwall data');
      console.log(`   Match ID: ${updatedMatch.match_id}`);
      console.log(`   Teams: ${updatedMatch.teams.home.team_name} vs ${updatedMatch.teams.away.team_name}`);
      console.log(`   Score: ${updatedMatch.score.home} - ${updatedMatch.score.away}`);
      console.log(`   Date: ${updatedMatch.match_info.starting_at}`);
      console.log(`   Status: ${updatedMatch.match_status.name}`);
      console.log(`   Lineup: ${updatedMatch.lineup.home.length + updatedMatch.lineup.away.length} players`);
      console.log(`   Events: ${updatedMatch.events.length} events`);
      console.log(`   Comments: ${updatedMatch.comments.length} comments`);
      console.log('\n✨ The formation display should now work correctly in the frontend!');
    } else {
      console.error('❌ Failed to update database');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected from MongoDB');
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };