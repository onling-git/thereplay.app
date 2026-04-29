/**
 * Test Script: Atom Feed Support
 * 
 * This script tests the RSS/Atom feed aggregator with both feed types
 * to verify that the implementation correctly handles both formats.
 */

const { fetchRssFeed } = require('../utils/rssAggregator');

async function testAtomFeedSupport() {
  console.log('='.repeat(60));
  console.log('Testing RSS and Atom Feed Support');
  console.log('='.repeat(60));
  
  // Test RSS feed (BBC Sport)
  const rssFeed = {
    id: 'test-rss',
    name: 'Test RSS Feed (BBC Sport)',
    url: 'http://feeds.bbci.co.uk/sport/football/rss.xml',
    enabled: true,
    priority: 1,
    fetchTimeout: 10000,
    userAgent: 'Mozilla/5.0 (compatible; FootballNewsAggregator/1.0)',
    feedType: 'auto'
  };
  
  // Test Atom feed (Reddit example - you can change this to any Atom feed)
  const atomFeed = {
    id: 'test-atom',
    name: 'Test Atom Feed (Example)',
    url: 'https://www.reddit.com/r/soccer/.rss',
    enabled: true,
    priority: 1,
    fetchTimeout: 10000,
    userAgent: 'Mozilla/5.0 (compatible; FootballNewsAggregator/1.0)',
    feedType: 'auto'
  };
  
  try {
    console.log('\n--- Testing RSS Feed ---');
    const rssArticles = await fetchRssFeed(rssFeed);
    console.log(`✓ RSS Feed parsed successfully: ${rssArticles.length} articles`);
    if (rssArticles.length > 0) {
      console.log('  First article:', {
        title: rssArticles[0].title,
        url: rssArticles[0].url,
        published: rssArticles[0].published_at
      });
    }
  } catch (error) {
    console.error('✗ RSS Feed test failed:', error.message);
  }
  
  try {
    console.log('\n--- Testing Atom Feed ---');
    const atomArticles = await fetchRssFeed(atomFeed);
    console.log(`✓ Atom Feed parsed successfully: ${atomArticles.length} articles`);
    if (atomArticles.length > 0) {
      console.log('  First article:', {
        title: atomArticles[0].title,
        url: atomArticles[0].url,
        published: atomArticles[0].published_at
      });
    }
  } catch (error) {
    console.error('✗ Atom Feed test failed:', error.message);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Test Complete');
  console.log('='.repeat(60));
  
  process.exit(0);
}

// Run the test
testAtomFeedSupport().catch(error => {
  console.error('Test failed with error:', error);
  process.exit(1);
});
