// Check which team_id was assigned to collected tweets
require('dotenv').config();
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');

async function checkTweetTeamAssignment() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const matchId = 19432238;

    console.log('🔍 TWEET TEAM ASSIGNMENT FOR MATCH', matchId);
    console.log('='.repeat(80));

    // Count tweets by team_id
    const tweetsByTeam = await Tweet.aggregate([
      { $match: { match_id: matchId } },
      { $group: { 
        _id: '$team_id', 
        count: { $sum: 1 },
        samples: { $push: { text: '$text', author: '$author.userName' } }
      }},
      { $sort: { count: -1 } }
    ]);

    console.log(`\nTweets by team_id:`);
    tweetsByTeam.forEach(group => {
      console.log(`\nTeam ID ${group._id}: ${group.count} tweets`);
      console.log('Sample tweets:');
      group.samples.slice(0, 3).forEach((sample, i) => {
        console.log(`  [${i + 1}] @${sample.author}: ${sample.text.substring(0, 60)}...`);
      });
    });

    console.log('\n' + '='.repeat(80));
    console.log('INTERPRETATION:');
    console.log('='.repeat(80));
    console.log('Team ID 283 = Wrexham');
    console.log('Team ID 65 = Southampton');
    console.log('');
    
    const wrexhamCount = tweetsByTeam.find(g => g._id === 283)?.count || 0;
    const southamptonCount = tweetsByTeam.find(g => g._id === 65)?.count || 0;
    
    console.log(`✅ Wrexham tweets: ${wrexhamCount}`);
    console.log(`✅ Southampton tweets: ${southamptonCount}`);
    console.log('');
    
    if (wrexhamCount === 0) {
      console.log('✅ CORRECT: Wrexham has no Twitter configured, so 0 tweets is expected');
      console.log('   Their report will generate without tweet bias ✓');
    }
    
    if (southamptonCount > 0) {
      console.log('✅ CORRECT: Southampton has Twitter configured, tweets collected');
      console.log('   Their report will include social context ✓');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

checkTweetTeamAssignment();
