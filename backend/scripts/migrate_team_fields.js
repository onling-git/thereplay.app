/**
 * Migrate existing matches to populate flat team fields from nested structure
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.DBURI;

async function migrateTeamFields() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const Match = mongoose.model('Match', new mongoose.Schema({}, { strict: false, collection: 'matches' }));
    
    console.log('Querying matches...');
    // Find matches from today only (UTC)
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    
    console.log('Date range:', today.toISOString(), 'to', tomorrow.toISOString());
    
    const matches = await Match.find({
      'teams.home.team_name': { $exists: true },
      'match_info.starting_at': { 
        $gte: today,
        $lt: tomorrow
      }
    }).lean();

    console.log(`📊 Found ${matches.length} matches from today (${today.toISOString().split('T')[0]}) with nested teams structure\n`);

    let updated = 0;
    let errors = 0;

    for (const match of matches) {
      try {
        const updateFields = {};
        
        if (match.teams?.home) {
          if (!match.home_team && match.teams.home.team_name) {
            updateFields.home_team = match.teams.home.team_name;
          }
          if (match.home_team_id == null && match.teams.home.team_id != null) {
            updateFields.home_team_id = match.teams.home.team_id;
          }
          if (!match.home_team_slug && match.teams.home.team_slug) {
            updateFields.home_team_slug = match.teams.home.team_slug;
          }
        }
        
        if (match.teams?.away) {
          if (!match.away_team && match.teams.away.team_name) {
            updateFields.away_team = match.teams.away.team_name;
          }
          if (match.away_team_id == null && match.teams.away.team_id != null) {
            updateFields.away_team_id = match.teams.away.team_id;
          }
          if (!match.away_team_slug && match.teams.away.team_slug) {
            updateFields.away_team_slug = match.teams.away.team_slug;
          }
        }

        if (Object.keys(updateFields).length > 0) {
          await Match.updateOne(
            { _id: match._id },
            { $set: updateFields }
          );
          updated++;
          
          if (updated % 100 === 0) {
            console.log(`✅ Migrated ${updated} matches...`);
          }
        }
      } catch (e) {
        console.error(`❌ Error migrating match ${match.match_id}:`, e.message);
        errors++;
      }
    }

    console.log(`\n📊 Migration complete!`);
    console.log(`   ✅ Updated: ${updated}`);
    console.log(`   ❌ Errors: ${errors}`);

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

migrateTeamFields();
