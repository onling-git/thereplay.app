require('dotenv').config();
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');

mongoose.connect(process.env.DBURI).then(async () => {
  try {
    // Get the keyword tweets from around match time
    const keywordTweets = await Tweet.find({ 
      team_id: 65,
      'collection_context.search_type': 'keyword',
      created_at: { $gte: new Date('2026-01-31T14:00:00.000Z') }
    }).sort({ created_at: 1 }).limit(5).lean();
    
    console.log('Keyword tweets from match day:');
    keywordTweets.forEach(t => {
      console.log('\n---');
      console.log('Time:', t.created_at);
      console.log('Author:', t.author_handle);
      console.log('Text:', t.text.substring(0, 100));
      console.log('Collection context:', JSON.stringify(t.collection_context, null, 2));
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});
