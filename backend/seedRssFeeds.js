const mongoose = require('mongoose');
const RssFeed = require('./models/RssFeed');
const { rssFeeds } = require('./config/rssFeeds');

/**
 * Seed RSS feeds from config into database
 * Run this once to migrate from config file to database
 */
async function seedRssFeeds() {
  try {
    console.log('[seed-rss] Starting RSS feed seeding...');
    
    // Check if feeds already exist
    const existingCount = await RssFeed.countDocuments();
    if (existingCount > 0) {
      console.log(`[seed-rss] Found ${existingCount} existing RSS feeds. Skipping seed.`);
      console.log('[seed-rss] To force re-seed, delete the rss_feeds collection first.');
      return;
    }
    
    // Insert feeds from config
    const feedsToInsert = rssFeeds.map(feed => ({
      id: feed.id,
      name: feed.name,
      url: feed.url,
      enabled: feed.enabled,
      priority: feed.priority,
      keywords: feed.keywords || [],
      description: `Auto-imported from config: ${feed.name}`
    }));
    
    const insertedFeeds = await RssFeed.insertMany(feedsToInsert);
    
    console.log(`[seed-rss] Successfully seeded ${insertedFeeds.length} RSS feeds:`);
    insertedFeeds.forEach(feed => {
      console.log(`  ✅ ${feed.name} (${feed.enabled ? 'enabled' : 'disabled'})`);
    });
    
    console.log('[seed-rss] RSS feed seeding completed successfully!');
    
  } catch (error) {
    console.error('[seed-rss] Error seeding RSS feeds:', error);
    throw error;
  }
}

module.exports = { seedRssFeeds };

// If this script is run directly
if (require.main === module) {
  require('dotenv').config();
  const { connectDB } = require('./db/connect');
  
  (async () => {
    try {
      await connectDB(process.env.DBURI);
      await seedRssFeeds();
      process.exit(0);
    } catch (error) {
      console.error('Seeding failed:', error);
      process.exit(1);
    }
  })();
}