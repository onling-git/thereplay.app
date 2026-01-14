const { fetchRssFeed } = require('../utils/rssAggregator');
const { rssFeeds } = require('../config/rssFeeds');

/**
 * GET /api/debug/rss-feed/:feedId
 * Debug endpoint to inspect raw RSS feed data
 */
exports.debugRssFeed = async (req, res) => {
  try {
    const { feedId } = req.params;
    const limit = parseInt(req.query.limit) || 3; // Default to 3 items for debugging
    
    // Find the feed configuration
    const feedConfig = rssFeeds.find(feed => feed.id === feedId);
    if (!feedConfig) {
      return res.status(404).json({
        error: 'Feed not found',
        availableFeeds: rssFeeds.map(f => ({ id: f.id, name: f.name }))
      });
    }
    
    console.log(`[debug] Fetching RSS feed for debugging: ${feedConfig.name}`);
    
    // Fetch the feed
    const articles = await fetchRssFeed(feedConfig);
    
    // Return limited results with debug info
    const debugResults = articles.slice(0, limit).map(article => ({
      title: article.title,
      summary: article.summary.substring(0, 200) + '...',
      url: article.url,
      source: article.source,
      published_at: article.published_at,
      debug_urls: article._debug_urls,
      debug_raw_item: article._debug_raw_item
    }));
    
    res.json({
      success: true,
      feed: {
        id: feedConfig.id,
        name: feedConfig.name,
        url: feedConfig.url
      },
      total_articles: articles.length,
      debug_sample: debugResults
    });
    
  } catch (error) {
    console.error('[debug] RSS feed debug error:', error);
    res.status(500).json({
      error: 'Debug failed',
      message: error.message
    });
  }
};

/**
 * GET /api/debug/rss-feeds
 * List all available RSS feeds for debugging
 */
exports.listRssFeeds = async (req, res) => {
  try {
    const feeds = rssFeeds.map(feed => ({
      id: feed.id,
      name: feed.name,
      url: feed.url,
      enabled: feed.enabled,
      priority: feed.priority
    }));
    
    res.json({
      success: true,
      feeds
    });
    
  } catch (error) {
    console.error('[debug] List RSS feeds error:', error);
    res.status(500).json({
      error: 'Failed to list feeds',
      message: error.message
    });
  }
};