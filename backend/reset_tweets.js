// Delete existing tweets for match and re-collect with smart team assignment
require('dotenv').config();
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');

async function resetTweets() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const matchId = 19432238;

    console.log('🗑️  Deleting existing tweets for match', matchId);
    const deleteResult = await Tweet.deleteMany({ match_id: matchId });
    console.log(`✅ Deleted ${deleteResult.deletedCount} tweets\n`);

    console.log('Now run: node test_match_finished_webhook.js');
    console.log('This will re-collect tweets with smart team assignment');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

resetTweets();
