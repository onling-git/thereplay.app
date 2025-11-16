const RssFeed = require('../models/RssFeed');
const { clearCache } = require('../utils/rssAggregator');

/**
 * GET /api/rss-feeds
 * Get all RSS feeds with optional filtering
 */
exports.getRssFeeds = async (req, res) => {
  try {
    const { enabled, search } = req.query;
    
    let query = {};
    
    // Filter by enabled status
    if (enabled !== undefined) {
      query.enabled = enabled === 'true';
    }
    
    // Search in name or keywords
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { keywords: { $in: [new RegExp(search, 'i')] } },
        { url: { $regex: search, $options: 'i' } }
      ];
    }
    
    const feeds = await RssFeed.find(query).sort({ priority: 1, name: 1 });
    
    res.json({
      success: true,
      count: feeds.length,
      data: feeds
    });
    
  } catch (error) {
    console.error('[rss-feeds] Error getting RSS feeds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get RSS feeds',
      error: error.message
    });
  }
};

/**
 * GET /api/rss-feeds/:id
 * Get a specific RSS feed by ID
 */
exports.getRssFeed = async (req, res) => {
  try {
    const feed = await RssFeed.findOne({ id: req.params.id });
    
    if (!feed) {
      return res.status(404).json({
        success: false,
        message: 'RSS feed not found'
      });
    }
    
    res.json({
      success: true,
      data: feed
    });
    
  } catch (error) {
    console.error('[rss-feeds] Error getting RSS feed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get RSS feed',
      error: error.message
    });
  }
};

/**
 * POST /api/rss-feeds
 * Create a new RSS feed
 */
exports.createRssFeed = async (req, res) => {
  try {
    const feedData = req.body;
    
    // Check if feed with this ID already exists
    const existingFeed = await RssFeed.findOne({ id: feedData.id });
    if (existingFeed) {
      return res.status(400).json({
        success: false,
        message: 'RSS feed with this ID already exists'
      });
    }
    
    const feed = new RssFeed(feedData);
    await feed.save();
    
    // Clear cache since feeds changed
    clearCache();
    
    res.status(201).json({
      success: true,
      message: 'RSS feed created successfully',
      data: feed
    });
    
  } catch (error) {
    console.error('[rss-feeds] Error creating RSS feed:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to create RSS feed',
      error: error.message
    });
  }
};

/**
 * PUT /api/rss-feeds/:id
 * Update an RSS feed
 */
exports.updateRssFeed = async (req, res) => {
  try {
    const feed = await RssFeed.findOneAndUpdate(
      { id: req.params.id },
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!feed) {
      return res.status(404).json({
        success: false,
        message: 'RSS feed not found'
      });
    }
    
    // Clear cache since feeds changed
    clearCache();
    
    res.json({
      success: true,
      message: 'RSS feed updated successfully',
      data: feed
    });
    
  } catch (error) {
    console.error('[rss-feeds] Error updating RSS feed:', error);
    res.status(400).json({
      success: false,
      message: 'Failed to update RSS feed',
      error: error.message
    });
  }
};

/**
 * DELETE /api/rss-feeds/:id
 * Delete an RSS feed
 */
exports.deleteRssFeed = async (req, res) => {
  try {
    const feed = await RssFeed.findOneAndDelete({ id: req.params.id });
    
    if (!feed) {
      return res.status(404).json({
        success: false,
        message: 'RSS feed not found'
      });
    }
    
    // Clear cache since feeds changed
    clearCache();
    
    res.json({
      success: true,
      message: 'RSS feed deleted successfully'
    });
    
  } catch (error) {
    console.error('[rss-feeds] Error deleting RSS feed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete RSS feed',
      error: error.message
    });
  }
};

/**
 * PUT /api/rss-feeds/:id/toggle
 * Toggle RSS feed enabled status
 */
exports.toggleRssFeed = async (req, res) => {
  try {
    const feed = await RssFeed.findOne({ id: req.params.id });
    
    if (!feed) {
      return res.status(404).json({
        success: false,
        message: 'RSS feed not found'
      });
    }
    
    feed.enabled = !feed.enabled;
    await feed.save();
    
    // Clear cache since feeds changed
    clearCache();
    
    res.json({
      success: true,
      message: `RSS feed ${feed.enabled ? 'enabled' : 'disabled'} successfully`,
      data: feed
    });
    
  } catch (error) {
    console.error('[rss-feeds] Error toggling RSS feed:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle RSS feed',
      error: error.message
    });
  }
};

/**
 * GET /api/rss-feeds/stats
 * Get RSS feed statistics
 */
exports.getRssFeedStats = async (req, res) => {
  try {
    const totalFeeds = await RssFeed.countDocuments();
    const enabledFeeds = await RssFeed.countDocuments({ enabled: true });
    const disabledFeeds = await RssFeed.countDocuments({ enabled: false });
    
    const recentlyUpdated = await RssFeed.find({ lastFetched: { $exists: true } })
      .sort({ lastFetched: -1 })
      .limit(5)
      .select('id name lastFetched lastSuccess articleCount');
    
    const feedsWithErrors = await RssFeed.find({ 
      lastError: { $exists: true, $ne: null } 
    }).select('id name lastError lastFetched');
    
    res.json({
      success: true,
      stats: {
        totalFeeds,
        enabledFeeds,
        disabledFeeds,
        feedsWithErrors: feedsWithErrors.length,
        recentlyUpdated,
        errorFeeds: feedsWithErrors
      }
    });
    
  } catch (error) {
    console.error('[rss-feeds] Error getting RSS feed stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get RSS feed stats',
      error: error.message
    });
  }
};