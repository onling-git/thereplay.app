const mongoose = require('mongoose');
require('dotenv').config();
const Match = require('./models/Match');

async function checkMatchHistory() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    const matchId = 19432238;
    const match = await Match.findOne({ match_id: matchId });

    if (!match) {
      console.log(`❌ Match ${matchId} not found in database`);
      return;
    }

    console.log('\n📊 Full Match Document:');
    console.log(JSON.stringify(match, null, 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkMatchHistory();
