// Update team match references (next_match) for all teams
// Run with: node backend/scripts/update-team-references.js

require('dotenv').config({ path: require('path').join(__dirname, '../.env.staging') });
const mongoose = require('mongoose');

async function updateAllTeamReferences() {
  try {
    console.log('🔌 Connecting to database...');
    await mongoose.connect(process.env.DBURI);
    console.log('✅ Connected to database');

    const Team = require('../models/Team');
    const Match = require('../models/Match');

    console.log('📊 Fetching all teams...');
    const teams = await Team.find({}).select('id slug name').lean();
    console.log(`Found ${teams.length} teams`);

    let updated = 0;
    let skipped = 0;
    const now = new Date();

    console.log('🔄 Updating team references...');
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      
      if (i % 50 === 0) {
        console.log(`Progress: ${i}/${teams.length} teams processed...`);
      }

      try {
        // Find next upcoming match for this team
        const nextMatch = await Match.findOne({
          $and: [
            {
              $or: [
                { 'teams.home.team_id': team.id },
                { 'teams.away.team_id': team.id }
              ]
            },
            {
              $or: [
                { 'match_info.starting_at': { $gt: now } },
                { date: { $gt: now } }
              ]
            }
          ]
        })
        .sort({ 'match_info.starting_at': 1, date: 1 })
        .select('match_id match_info.starting_at date')
        .lean();

        if (nextMatch) {
          const nextMatchDate = nextMatch.match_info?.starting_at || nextMatch.date;
          
          await Team.findOneAndUpdate(
            { id: team.id },
            {
              $set: {
                next_match: nextMatch.match_id,
                next_game_at: new Date(nextMatchDate)
              }
            }
          );
          updated++;
        } else {
          skipped++;
        }

      } catch (teamError) {
        console.error(`❌ Error updating team ${team.slug}:`, teamError.message);
      }
    }

    console.log('');
    console.log('✅ Team reference update complete!');
    console.log(`   - ${updated} teams updated with next_match`);
    console.log(`   - ${skipped} teams have no upcoming matches`);

  } catch (error) {
    console.error('❌ Update failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from database');
  }
}

updateAllTeamReferences();
