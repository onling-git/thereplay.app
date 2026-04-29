require('dotenv').config();
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');

mongoose.connect(process.env.DBURI).then(async () => {
  try {
    const matchStart = new Date('2026-01-31T12:30:00.000Z');
    const matchEnd = new Date('2026-01-31T14:07:00.000Z');
    
    console.log('Searching for ALL Southampton tweets during match window...');
    console.log('Match window:', matchStart, 'to', matchEnd);
    console.log('');
    
    // Find ALL tweets for Southampton during match time, regardless of categorization
    const allMatchTimeTweets = await Tweet.find({
      team_id: 65,
      created_at: {
        $gte: matchStart,
        $lte: matchEnd
      }
    }).sort({ created_at: 1 }).lean();
    
    console.log(`Found ${allMatchTimeTweets.length} tweets during match time`);
    console.log('');
    
    if (allMatchTimeTweets.length > 0) {
      allMatchTimeTweets.forEach((t, i) => {
        console.log(`\nTweet ${i + 1}:`);
        console.log('Time:', t.created_at);
        console.log('Author handle:', t.author_handle || t.author?.userName || 'MISSING');
        console.log('Text:', t.text.substring(0, 80) + '...');
        console.log('Search type:', t.collection_context?.search_type || 'NOT SET');
        console.log('Source priority:', t.collection_context?.source_priority || 'NOT SET');
        console.log('Has author object:', !!t.author);
      });
    } else {
      console.log('❌ NO tweets found during actual match time');
      console.log('');
      console.log('Checking 1 hour before and after match:');
      const expandedTweets = await Tweet.find({
        team_id: 65,
        created_at: {
          $gte: new Date(matchStart.getTime() - 60 * 60 * 1000),
          $lte: new Date(matchEnd.getTime() + 60 * 60 * 1000)
        }
      }).sort({ created_at: 1 }).lean();
      
      console.log(`Found ${expandedTweets.length} tweets in expanded window`);
      expandedTweets.forEach(t => {
        const timeDesc = t.created_at < matchStart ? '⏪ PRE-MATCH' : 
                        t.created_at > matchEnd ? '⏩ POST-MATCH' : 
                        '✅ DURING MATCH';
        console.log(`${timeDesc} - ${t.created_at} - ${(t.author_handle || t.author?.userName || 'unknown')}`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});
