// Check team data for Wrexham and Southampton
require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('./models/Team');

async function checkTeams() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const wrexham = await Team.findOne({ slug: 'wrexham' }).lean();
    const southampton = await Team.findOne({ slug: 'southampton' }).lean();

    console.log('🏠 WREXHAM');
    console.log('='.repeat(80));
    if (wrexham) {
      console.log('Found:', true);
      console.log('ID:', wrexham.id);
      console.log('_id:', wrexham._id);
      console.log('Name:', wrexham.name);
      console.log('Slug:', wrexham.slug);
      console.log('Team ID:', wrexham.team_id);
    } else {
      console.log('❌ Not found in Teams collection');
    }

    console.log('\n⚽ SOUTHAMPTON');
    console.log('='.repeat(80));
    if (southampton) {
      console.log('Found:', true);
      console.log('ID:', southampton.id);
      console.log('_id:', southampton._id);
      console.log('Name:', southampton.name);
      console.log('Slug:', southampton.slug);
      console.log('Team ID:', southampton.team_id);
    } else {
      console.log('❌ Not found in Teams collection');
    }

    // Check what the schema looks like
    console.log('\n📋 ALL TEAMS (sample)');
    console.log('='.repeat(80));
    const allTeams = await Team.find({}).limit(5).lean();
    console.log(`Total teams in database: ${await Team.countDocuments()}`);
    
    if (allTeams.length > 0) {
      console.log('\nSample team structure:');
      console.log(JSON.stringify(allTeams[0], null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

checkTeams();
