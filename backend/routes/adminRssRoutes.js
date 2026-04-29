// routes/adminRssRoutes.js
const express = require('express');
const router = express.Router();
const RssFeed = require('../models/RssFeed');
const adminAuth = require('../middleware/adminAuth');

// All admin RSS routes require admin authentication (API key or admin user)
router.use(adminAuth(true));

// Get all RSS feeds
router.get('/feeds', async (req, res) => {
  try {
    const { enabled, priority_min, priority_max, search } = req.query;
    
    // Build query
    let query = {};
    
    if (enabled !== undefined) {
      query.enabled = enabled === 'true';
    }
    
    if (priority_min || priority_max) {
      query.priority = {};
      if (priority_min) query.priority.$gte = parseInt(priority_min);
      if (priority_max) query.priority.$lte = parseInt(priority_max);
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { url: { $regex: search, $options: 'i' } },
        { keywords: { $in: [new RegExp(search, 'i')] } }
      ];
    }

    const feeds = await RssFeed.find(query).sort({ priority: -1, name: 1 });

    const feedData = feeds.map(feed => ({
      id: feed._id,
      feedId: feed.id,
      name: feed.name,
      url: feed.url,
      enabled: feed.enabled,
      priority: feed.priority,
      keywords: feed.keywords,
      description: feed.description,
      scope: feed.scope,
      teams: feed.teams,
      leagues: feed.leagues,
      countries: feed.countries,
      lastFetched: feed.lastFetched,
      lastSuccess: feed.lastSuccess,
      lastError: feed.lastError,
      articleCount: feed.articleCount,
      fetchTimeout: feed.fetchTimeout,
      userAgent: feed.userAgent,
      status: feed.status, // virtual field
      createdAt: feed.createdAt,
      updatedAt: feed.updatedAt
    }));

    res.json({
      success: true,
      feeds: feedData,
      count: feedData.length,
      query: query
    });
  } catch (error) {
    console.error('Error fetching RSS feeds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RSS feeds',
      message: error.message
    });
  }
});

// Get specific RSS feed
router.get('/feeds/:feedId', async (req, res) => {
  try {
    const { feedId } = req.params;
    
    // Try to find by MongoDB _id first, then by feedId
    let feed = await RssFeed.findById(feedId);
    if (!feed) {
      feed = await RssFeed.findOne({ id: feedId });
    }

    if (!feed) {
      return res.status(404).json({
        success: false,
        error: 'RSS feed not found'
      });
    }

    res.json({
      success: true,
      feed: {
        id: feed._id,
        feedId: feed.id,
        name: feed.name,
        url: feed.url,
        enabled: feed.enabled,
        priority: feed.priority,
        keywords: feed.keywords,
        description: feed.description,
        scope: feed.scope,
        teams: feed.teams,
        leagues: feed.leagues,
        countries: feed.countries,
        lastFetched: feed.lastFetched,
        lastSuccess: feed.lastSuccess,
        lastError: feed.lastError,
        articleCount: feed.articleCount,
        fetchTimeout: feed.fetchTimeout,
        userAgent: feed.userAgent,
        status: feed.status,
        createdAt: feed.createdAt,
        updatedAt: feed.updatedAt
      }
    });
  } catch (error) {
    console.error('Error fetching RSS feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RSS feed',
      message: error.message
    });
  }
});

// Create new RSS feed
router.post('/feeds', async (req, res) => {
  try {
    const {
      id: feedId, // Optional now - will be auto-generated if not provided
      name,
      url,
      enabled = true,
      priority = 1,
      keywords = [],
      description = '',
      fetchTimeout = 10000,
      userAgent
    } = req.body;

    // Name and URL are required
    if (!name || !url) {
      return res.status(400).json({
        success: false,
        error: 'Feed name and URL are required'
      });
    }

    // Validate URL format
    if (!/^https?:\/\/.+/.test(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL must be a valid HTTP or HTTPS URL'
      });
    }

    // Check if feed ID already exists (if provided)
    if (feedId) {
      const existingFeed = await RssFeed.findOne({ id: feedId });
      if (existingFeed) {
        return res.status(400).json({
          success: false,
          error: 'RSS feed with this ID already exists'
        });
      }
    }

    const newFeed = new RssFeed({
      // ID will be auto-generated if not provided (via default in schema)
      id: feedId || undefined,
      name: name.trim(),
      url: url.trim(),
      enabled,
      priority: priority ? Math.max(1, Math.min(100, priority)) : 50, // Clamp between 1-100, default 50
      keywords: Array.isArray(keywords) ? keywords.map(k => k.trim().toLowerCase()).filter(k => k) : [],
      description: description.trim(),
      fetchTimeout: Math.max(1000, Math.min(30000, fetchTimeout)), // Clamp between 1-30 seconds
      userAgent: userAgent || 'Mozilla/5.0 (compatible; FootballNewsAggregator/1.0)',
      scope: 'generic', // All feeds created as generic
      teams: [], // Teams assigned via Team Feed Subscriptions tab
      leagues: [],
      countries: []
    });

    await newFeed.save();

    res.status(201).json({
      success: true,
      message: 'RSS feed created successfully',
      feed: {
        id: newFeed._id,
        feedId: newFeed.id,
        name: newFeed.name,
        url: newFeed.url,
        enabled: newFeed.enabled,
        priority: newFeed.priority,
        keywords: newFeed.keywords,
        description: newFeed.description,
        scope: newFeed.scope,
        teams: newFeed.teams,
        leagues: newFeed.leagues,
        countries: newFeed.countries,
        fetchTimeout: newFeed.fetchTimeout,
        userAgent: newFeed.userAgent,
        status: newFeed.status,
        createdAt: newFeed.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating RSS feed:', error);
    
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        error: 'RSS feed ID must be unique'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to create RSS feed',
      message: error.message
    });
  }
});

// Update RSS feed
router.put('/feeds/:feedId', async (req, res) => {
  try {
    const { feedId } = req.params;
    const {
      name,
      url,
      enabled,
      priority,
      keywords,
      description,
      fetchTimeout,
      userAgent,
      scope,
      teams,
      leagues,
      countries
    } = req.body;

    // Find feed by MongoDB _id or feedId
    let feed = await RssFeed.findById(feedId);
    if (!feed) {
      feed = await RssFeed.findOne({ id: feedId });
    }

    if (!feed) {
      return res.status(404).json({
        success: false,
        error: 'RSS feed not found'
      });
    }

    // Validate URL if provided
    if (url && !/^https?:\/\/.+/.test(url)) {
      return res.status(400).json({
        success: false,
        error: 'URL must be a valid HTTP or HTTPS URL'
      });
    }

    // Validate scope if provided
    if (scope && !['generic', 'team', 'league', 'country'].includes(scope)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid scope. Must be one of: generic, team, league, country'
      });
    }

    // Update fields
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (url !== undefined) updates.url = url.trim();
    if (enabled !== undefined) updates.enabled = enabled;
    if (priority !== undefined) updates.priority = Math.max(1, Math.min(100, priority));
    if (keywords !== undefined) {
      updates.keywords = Array.isArray(keywords) ? keywords.map(k => k.trim().toLowerCase()).filter(k => k) : [];
    }
    if (description !== undefined) updates.description = description.trim();
    if (fetchTimeout !== undefined) {
      updates.fetchTimeout = Math.max(1000, Math.min(30000, fetchTimeout));
    }
    if (userAgent !== undefined) updates.userAgent = userAgent;
    if (scope !== undefined) updates.scope = scope;
    if (teams !== undefined) {
      updates.teams = Array.isArray(teams) ? teams.map(t => String(t).toLowerCase()).filter(t => t) : [];
    }
    if (leagues !== undefined) {
      updates.leagues = Array.isArray(leagues) ? leagues.map(l => Number(l)).filter(l => !isNaN(l)) : [];
    }
    if (countries !== undefined) {
      updates.countries = Array.isArray(countries) ? countries.map(c => String(c).toLowerCase()).filter(c => c) : [];
    }

    const updatedFeed = await RssFeed.findByIdAndUpdate(
      feed._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'RSS feed updated successfully',
      feed: {
        id: updatedFeed._id,
        feedId: updatedFeed.id,
        name: updatedFeed.name,
        url: updatedFeed.url,
        enabled: updatedFeed.enabled,
        priority: updatedFeed.priority,
        keywords: updatedFeed.keywords,
        description: updatedFeed.description,
        scope: updatedFeed.scope,
        teams: updatedFeed.teams,
        leagues: updatedFeed.leagues,
        countries: updatedFeed.countries,
        lastFetched: updatedFeed.lastFetched,
        lastSuccess: updatedFeed.lastSuccess,
        lastError: updatedFeed.lastError,
        articleCount: updatedFeed.articleCount,
        fetchTimeout: updatedFeed.fetchTimeout,
        userAgent: updatedFeed.userAgent,
        status: updatedFeed.status,
        updatedAt: updatedFeed.updatedAt
      }
    });
  } catch (error) {
    console.error('Error updating RSS feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update RSS feed',
      message: error.message
    });
  }
});

// Delete RSS feed
router.delete('/feeds/:feedId', async (req, res) => {
  try {
    const { feedId } = req.params;

    // Find feed by MongoDB _id or feedId
    let feed = await RssFeed.findById(feedId);
    if (!feed) {
      feed = await RssFeed.findOne({ id: feedId });
    }

    if (!feed) {
      return res.status(404).json({
        success: false,
        error: 'RSS feed not found'
      });
    }

    await RssFeed.findByIdAndDelete(feed._id);

    res.json({
      success: true,
      message: 'RSS feed deleted successfully',
      deletedFeed: {
        feedId: feed.id,
        name: feed.name,
        url: feed.url
      }
    });
  } catch (error) {
    console.error('Error deleting RSS feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete RSS feed',
      message: error.message
    });
  }
});

// Toggle RSS feed enabled status
router.patch('/feeds/:feedId/toggle', async (req, res) => {
  try {
    const { feedId } = req.params;

    // Find feed by MongoDB _id or feedId
    let feed = await RssFeed.findById(feedId);
    if (!feed) {
      feed = await RssFeed.findOne({ id: feedId });
    }

    if (!feed) {
      return res.status(404).json({
        success: false,
        error: 'RSS feed not found'
      });
    }

    feed.enabled = !feed.enabled;
    await feed.save();

    res.json({
      success: true,
      message: `RSS feed ${feed.enabled ? 'enabled' : 'disabled'} successfully`,
      feed: {
        id: feed._id,
        feedId: feed.id,
        name: feed.name,
        enabled: feed.enabled,
        status: feed.status
      }
    });
  } catch (error) {
    console.error('Error toggling RSS feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle RSS feed',
      message: error.message
    });
  }
});

// Test RSS feed (fetch latest articles)
router.post('/feeds/:feedId/test', async (req, res) => {
  try {
    const { feedId } = req.params;

    // Find feed by MongoDB _id or feedId
    let feed = await RssFeed.findById(feedId);
    if (!feed) {
      feed = await RssFeed.findOne({ id: feedId });
    }

    if (!feed) {
      return res.status(404).json({
        success: false,
        error: 'RSS feed not found'
      });
    }

    // Import RSS aggregator utility
    const { fetchFeed } = require('../utils/rssAggregator');

    const testResult = await fetchFeed({
      id: feed.id,
      name: feed.name,
      url: feed.url,
      fetchTimeout: feed.fetchTimeout,
      userAgent: feed.userAgent
    });

    // Update last fetch stats
    await RssFeed.findByIdAndUpdate(feed._id, {
      $set: {
        lastFetched: new Date(),
        lastSuccess: testResult.success ? new Date() : feed.lastSuccess,
        lastError: testResult.success ? null : testResult.error,
        articleCount: testResult.success ? testResult.articles.length : feed.articleCount
      }
    });

    res.json({
      success: testResult.success,
      message: testResult.success ? 'RSS feed test successful' : 'RSS feed test failed',
      feed: {
        id: feed._id,
        feedId: feed.id,
        name: feed.name,
        url: feed.url
      },
      testResult: {
        success: testResult.success,
        articleCount: testResult.success ? testResult.articles.length : 0,
        articles: testResult.success ? testResult.articles.slice(0, 5) : [], // Return first 5 articles
        error: testResult.error || null,
        fetchTime: testResult.fetchTime || null
      }
    });
  } catch (error) {
    console.error('Error testing RSS feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to test RSS feed',
      message: error.message
    });
  }
});

// Bulk operations
router.post('/feeds/bulk', async (req, res) => {
  try {
    const { operation, feedIds, data } = req.body;

    if (!operation || !Array.isArray(feedIds)) {
      return res.status(400).json({
        success: false,
        error: 'Operation and feedIds array are required'
      });
    }

    let result = {};

    switch (operation) {
      case 'enable':
        result = await RssFeed.updateMany(
          { _id: { $in: feedIds } },
          { $set: { enabled: true } }
        );
        break;
        
      case 'disable':
        result = await RssFeed.updateMany(
          { _id: { $in: feedIds } },
          { $set: { enabled: false } }
        );
        break;
        
      case 'delete':
        result = await RssFeed.deleteMany({ _id: { $in: feedIds } });
        break;
        
      case 'update_priority':
        if (!data?.priority) {
          return res.status(400).json({
            success: false,
            error: 'Priority value required for update_priority operation'
          });
        }
        result = await RssFeed.updateMany(
          { _id: { $in: feedIds } },
          { $set: { priority: Math.max(1, Math.min(100, data.priority)) } }
        );
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid operation. Supported: enable, disable, delete, update_priority'
        });
    }

    res.json({
      success: true,
      message: `Bulk ${operation} completed successfully`,
      operation,
      affected: result.modifiedCount || result.deletedCount || 0,
      total: feedIds.length
    });
  } catch (error) {
    console.error('Error in bulk operation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to perform bulk operation',
      message: error.message
    });
  }
});

// Get RSS feed statistics
router.get('/stats', async (req, res) => {
  try {
    const totalFeeds = await RssFeed.countDocuments();
    const enabledFeeds = await RssFeed.countDocuments({ enabled: true });
    const disabledFeeds = await RssFeed.countDocuments({ enabled: false });
    
    // Feeds with recent errors
    const errorFeeds = await RssFeed.countDocuments({ 
      lastError: { $ne: null },
      lastFetched: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
    });
    
    // Feeds never fetched
    const neverFetched = await RssFeed.countDocuments({ lastFetched: null });
    
    // Average article count
    const articleStats = await RssFeed.aggregate([
      { $group: { 
        _id: null, 
        avgArticles: { $avg: '$articleCount' },
        totalArticles: { $sum: '$articleCount' },
        maxArticles: { $max: '$articleCount' },
        minArticles: { $min: '$articleCount' }
      }}
    ]);

    // Priority distribution
    const priorityDistribution = await RssFeed.aggregate([
      { $group: { 
        _id: '$priority', 
        count: { $sum: 1 } 
      }},
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      stats: {
        total: totalFeeds,
        enabled: enabledFeeds,
        disabled: disabledFeeds,
        withErrors: errorFeeds,
        neverFetched: neverFetched,
        articles: articleStats[0] || {
          avgArticles: 0,
          totalArticles: 0,
          maxArticles: 0,
          minArticles: 0
        },
        priorityDistribution: priorityDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Error fetching RSS stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch RSS statistics',
      message: error.message
    });
  }
});

module.exports = router;