require('dotenv').config();
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');

mongoose.connect(process.env.DBURI).then(async () => {
  try {
    // Find recent reporter tweets for Southampton
    const reporterTweets = await Tweet.find({
      team_id: 65,
      'collection_context.search_type': 'reporter',
      created_at: { $gte: new Date('2026-01-31T00:00:00.000Z') }
    }).sort({ created_at: 1 }).lean();
    
    console.log(`Found ${reporterTweets.length} reporter tweets from Jan 31:`);
    console.log('');
    
    reporterTweets.forEach(t => {
      const matchStart = new Date('2026-01-31T12:30:00.000Z');
      const matchEnd = new Date('2026-01-31T14:07:00.000Z');
      const isDuringMatch = t.created_at >= matchStart && t.created_at <= matchEnd;
      
      console.log(`${isDuringMatch ? '✅ DURING' : '⏱️  OUTSIDE'} - ${t.created_at.toISOString()}`);
      console.log(`   Author: ${t.author?.userName || t.author_handle}`);
      console.log(`   Text: ${t.text.substring(0, 80)}...`);
      console.log('');
    });
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});
