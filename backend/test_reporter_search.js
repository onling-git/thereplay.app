require('dotenv').config();
const twitterService = require('./utils/twitterService');

async function testReporterSearch() {
  
  try {
    console.log('Testing reporter search for Southampton...');
    console.log('Reporter: @AlfieHouseEcho');
    console.log('');
    
    const result = await twitterService.searchByUser(['@AlfieHouseEcho'], {
      hashtag: '#saintsfc',  // Use hashtag instead of keywords
      since: new Date('2026-01-31T12:00:00.000Z'), // Noon on match day
      until: new Date('2026-01-31T15:00:00.000Z'), // 3pm on match day
      queryType: 'Latest'
    });
    
    console.log('Search results:');
    console.log(`Query: ${result.searchQuery}`);
    console.log(`Tweets found: ${result.tweets.length}`);
    console.log('');
    
    if (result.tweets.length > 0) {
      result.tweets.forEach((t, i) => {
        console.log(`Tweet ${i + 1}:`);
        console.log(`  Time: ${t.createdAt}`);
        console.log(`  Author: ${t.author?.userName}`);
        console.log(`  Text: ${t.text.substring(0, 80)}...`);
        console.log('');
      });
    } else {
      console.log('❌ NO TWEETS FOUND');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testReporterSearch();
