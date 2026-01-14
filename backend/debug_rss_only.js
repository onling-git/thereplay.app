const { aggregateFeeds, generateTeamKeywords, fetchRssFeed } = require('./utils/rssAggregator');

async function debugRSSAndKeywords() {
  try {
    // 1. Generate keywords for Southampton
    const teamName = 'Southampton';
    const keywords = generateTeamKeywords(teamName);
    console.log('\n=== GENERATED KEYWORDS ===');
    console.log('Team name used:', teamName);
    console.log('Generated keywords:', keywords);

    // 2. Fetch RSS feeds individually to check raw content
    console.log('\n=== FETCHING INDIVIDUAL RSS FEEDS ===');
    const { rssFeeds } = require('./config/rssFeeds');
    const enabledFeeds = rssFeeds.filter(feed => feed.enabled);
    
    let allRawArticles = [];
    
    for (const feed of enabledFeeds.slice(0, 4)) { // Test first 4 feeds
      try {
        console.log(`\n--- Fetching ${feed.name} ---`);
        const articles = await fetchRssFeed(feed);
        console.log(`Fetched ${articles.length} articles from ${feed.name}`);
        
        // Check for Southampton in raw articles before aggregation
        const southamptonArticles = articles.filter(article => {
          const title = (article.title || '').toLowerCase();
          const description = (article.description || '').toLowerCase();
          const content = `${title} ${description}`;
          return content.includes('southampton') || content.includes('saints');
        });
        
        if (southamptonArticles.length > 0) {
          console.log(`\n🎯 FOUND ${southamptonArticles.length} Southampton articles in ${feed.name}:`);
          southamptonArticles.forEach((article, index) => {
            console.log(`${index + 1}. "${article.title}"`);
            console.log(`   URL: ${article.url}`);
            console.log(`   Description: ${article.description?.substring(0, 150)}...`);
          });
          allRawArticles = allRawArticles.concat(southamptonArticles);
        } else {
          console.log(`❌ No Southampton articles found in ${feed.name}`);
        }
      } catch (error) {
        console.log(`Error fetching ${feed.name}:`, error.message);
      }
    }

    console.log(`\n=== RAW SOUTHAMPTON ARTICLES SUMMARY ===`);
    console.log(`Total Southampton articles found across feeds: ${allRawArticles.length}`);

    // 3. Now test aggregated results
    console.log('\n=== TESTING AGGREGATED RESULTS ===');
    const allArticles = await aggregateFeeds({ limit: 100 });
    console.log('Total aggregated articles:', allArticles.length);

    // 4. Search aggregated results for Southampton
    const southamptonInAggregated = allArticles.filter(article => {
      const title = (article.title || '').toLowerCase();
      const description = (article.description || '').toLowerCase();
      const content = `${title} ${description}`;
      return content.includes('southampton') || content.includes('saints');
    });

    console.log(`Southampton articles in aggregated results: ${southamptonInAggregated.length}`);
    southamptonInAggregated.forEach((article, index) => {
      console.log(`${index + 1}. "${article.title}" (Priority: ${article.feed_priority})`);
    });

    // 5. Test keyword matching logic
    console.log('\n=== TESTING KEYWORD MATCHING ===');
    const matchingArticles = allArticles.filter(article => {
      const title = (article.title || '').toLowerCase();
      const description = (article.description || '').toLowerCase();
      const content = `${title} ${description}`;
      
      return keywords.some(keyword => {
        const keywordLower = keyword.toLowerCase();
        const matches = content.includes(keywordLower);
        
        if (matches) {
          console.log(`MATCH found: "${article.title}" matches keyword "${keyword}"`);
        }
        
        return matches;
      });
    });

    console.log(`\nTotal matching articles using our keywords: ${matchingArticles.length}`);

  } catch (error) {
    console.error('Debug error:', error);
  }
}

// Load environment variables
require('dotenv').config();

debugRSSAndKeywords();