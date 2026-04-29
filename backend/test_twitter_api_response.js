// Test to see what TwitterAPI.io actually returns
require('dotenv').config();
const axios = require('axios');

async function testTwitterAPI() {
  const apiKey = process.env.TWITTERAPI_KEY;
  
  if (!apiKey) {
    console.error('TWITTERAPI_KEY not set');
    return;
  }

  try {
    // Search for a hashtag to get some tweets
    const response = await axios.get('https://api.twitterapi.io/twitter/tweet/advanced_search', {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      params: {
        query: '#SaintsFC',
        queryType: 'Latest'
      }
    });

    console.log('=== TwitterAPI.io Response Structure ===\n');
    
    if (response.data.tweets && response.data.tweets.length > 0) {
      const firstTweet = response.data.tweets[0];
      
      console.log('First Tweet Keys:', Object.keys(firstTweet));
      console.log('\n=== Full First Tweet ===');
      console.log(JSON.stringify(firstTweet, null, 2));
      
      // Check for specific fields
      console.log('\n=== Field Check ===');
      console.log('Has entities:', !!firstTweet.entities);
      console.log('Has media:', !!firstTweet.media);
      console.log('Has retweetedTweet:', !!firstTweet.retweetedTweet);
      console.log('Has quotedTweet:', !!firstTweet.quotedTweet);
      console.log('Has entities.media:', !!firstTweet.entities?.media);
      
      // Look for a tweet that might be a retweet or have media
      console.log('\n=== Checking All Tweets for Media/Retweets ===');
      response.data.tweets.forEach((tweet, idx) => {
        if (tweet.retweetedTweet || tweet.quotedTweet || tweet.media || tweet.entities?.media) {
          console.log(`\nTweet ${idx}:`, {
            id: tweet.id,
            hasRetweetedTweet: !!tweet.retweetedTweet,
            hasQuotedTweet: !!tweet.quotedTweet,
            hasMedia: !!tweet.media,
            hasEntitiesMedia: !!tweet.entities?.media
          });
        }
      });
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testTwitterAPI();
