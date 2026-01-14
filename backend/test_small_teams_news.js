// Suppress verbose console logging
const originalLog = console.log;
let logBuffer = [];
console.log = function(...args) {
  // Only log if it doesn't contain RSS debug info
  const msg = args[0] || '';
  if (typeof msg === 'string' && (msg.includes('[rss-') || msg.includes('[rss_') || msg.includes('href'))) {
    // Capture aggregator logs instead of suppressing
    if (msg.includes('[rss-aggregator]') || msg.includes('[rss-filter]')) {
      logBuffer.push(msg);
    }
    return; // Suppress other debug logs
  }
  originalLog.apply(console, args);
};

const mongoose = require('mongoose');
const { aggregateFeeds } = require('./utils/rssAggregator');

// Mock teams to test
const teamsToTest = [
  { name: 'Southampton', slug: 'southampton' },
  { name: 'Reading', slug: 'reading' },
  { name: 'Burnley', slug: 'burnley' },
  { name: 'Liverpool', slug: 'liverpool' }, // Control group - large team
];

async function testTeamNews() {
  try {
    console.log('\n===== Testing Small Teams News Feed (with 50x pool) =====\n');
    
    for (const team of teamsToTest) {
      logBuffer = [];
      console.log(`Testing ${team.name}...`);
      
      try {
        const articles = await aggregateFeeds({
          teamId: team.name,
          teamSlug: team.slug,
          limit: 20,
          useCache: false // Disable cache for testing
        });
        
        // Show aggregator logs
        const poolLog = logBuffer.find(l => l.includes('fetch pool'));
        const collectedLog = logBuffer.find(l => l.includes('Collected'));
        const filteredLog = logBuffer.find(l => l.includes('Filtered to'));
        const returnLog = logBuffer.find(l => l.includes('Returning'));
        
        if (poolLog) console.log(`  ${poolLog.substring(poolLog.indexOf('['))} `);
        if (collectedLog) console.log(`  ${collectedLog.substring(collectedLog.indexOf('['))} `);
        if (filteredLog) console.log(`  ${filteredLog.substring(filteredLog.indexOf('['))} `);
        if (returnLog) console.log(`  ${returnLog.substring(returnLog.indexOf('['))} `);
        
        console.log(`✓ Found ${articles.length} articles for ${team.name}`);
        
        if (articles.length > 0) {
          console.log(`  Sample articles:`);
          articles.slice(0, 2).forEach((article, i) => {
            console.log(`    ${i + 1}. "${article.title.substring(0, 60)}..."`);
          });
        } else {
          console.log(`⚠ WARNING: No articles found for ${team.name}!`);
        }
      } catch (error) {
        console.error(`✗ Error fetching news for ${team.name}:`, error.message);
      }
      console.log();
    }
    
    console.log('===== Test Complete =====\n');
    process.exit(0);
    
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

testTeamNews();
