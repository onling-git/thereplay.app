const { aggregateFeeds } = require('./utils/rssAggregator');

async function testTeamNewsDirect() {
  try {
    console.log('Testing direct team news aggregation...\n');
    
    // Test 1: General news
    console.log('1. Fetching general news...');
    const generalNews = await aggregateFeeds({ limit: 5 });
    console.log(`   Got ${generalNews.length} general articles`);
    
    // Test 2: Team news with slug
    console.log('\n2. Fetching news for team "southampton" (slug)...');
    const southamptonNews1 = await aggregateFeeds({ 
      teamId: 'Southampton',  // team name
      teamSlug: 'southampton',  // team slug
      limit: 10 
    });
    console.log(`   Got ${southamptonNews1.length} articles`);
    if (southamptonNews1.length > 0) {
      console.log('   First 3 articles:');
      southamptonNews1.slice(0, 3).forEach((article, i) => {
        console.log(`     ${i+1}. ${article.title}`);
      });
    }
    
    // Test 3: Team news with just name
    console.log('\n3. Fetching news for team "Reading" (name only)...');
    const readingNews = await aggregateFeeds({ 
      teamId: 'Reading',
      limit: 10 
    });
    console.log(`   Got ${readingNews.length} articles`);
    if (readingNews.length > 0) {
      console.log('   First 3 articles:');
      readingNews.slice(0, 3).forEach((article, i) => {
        console.log(`     ${i+1}. ${article.title}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error);
  }
}

testTeamNewsDirect();
