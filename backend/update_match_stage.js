require('dotenv').config();
const mongoose = require('mongoose');
const { get } = require('./utils/sportmonks');
const Match = require('./models/Match');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

async function updateMatchWithStageInfo() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    console.log('Connected to database');
    
    const matchId = 19631550;
    
    console.log(`🔍 Re-fetching match ${matchId} with stage information...\n`);
    
    // Fetch with comprehensive includes including stage
    const response = await get(`fixtures/${matchId}`, {
      include: 'events;participants;lineups.detailedposition;statistics;scores;periods;timeline;formations;league;season;venue;referees;comments;stage'
    });

    const fixture = response.data?.data;
    if (!fixture) {
      console.log('❌ No fixture data found');
      return;
    }

    console.log('✅ Stage information received:');
    console.log(`   Stage Name: ${fixture.stage?.name || 'N/A'}`);
    console.log(`   Stage Type ID: ${fixture.stage?.type_id || 'N/A'}`);
    console.log(`   League: ${fixture.league?.name || 'N/A'}`);
    
    // Normalize the fixture data
    const normalizedMatch = normaliseFixtureToMatchDoc(fixture);
    if (!normalizedMatch) {
      console.log('❌ Failed to normalize match data');
      return;
    }
    
    console.log('\\n🔄 Updating database with new stage information...');
    
    // Update the existing match with the new stage information
    const updateResult = await Match.updateOne(
      { match_id: matchId },
      { $set: { 
        'match_info.stage': normalizedMatch.match_info.stage,
        'match_info.league': normalizedMatch.match_info.league,
        'match_info.season': normalizedMatch.match_info.season
      }}
    );
    
    console.log(`✅ Database update result: ${updateResult.modifiedCount} document(s) modified`);
    
    // Verify the update
    const updatedMatch = await Match.findOne({ match_id: matchId }).lean();
    console.log('\\n📋 Verification - Updated match stage info:');
    console.log(`   Stage Name: ${updatedMatch.match_info?.stage?.name || 'N/A'}`);
    console.log(`   Competition: ${updatedMatch.match_info?.league?.name || 'N/A'}`);
    
    mongoose.disconnect();
    console.log('\\n✅ Stage information successfully updated!');
    
  } catch (error) {
    console.error('Error updating stage info:', error.message);
  }
}

updateMatchWithStageInfo();