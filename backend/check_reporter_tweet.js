require('dotenv').config();
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');

mongoose.connect(process.env.DBURI).then(async () => {
  try {
    // Get the reporter tweet
    const reporterTweet = await Tweet.findOne({ 
      team_id: 65,
      'collection_context.search_type': 'reporter'
    }).lean();
    
    console.log('Reporter tweet:');
    console.log(JSON.stringify(reporterTweet, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});
