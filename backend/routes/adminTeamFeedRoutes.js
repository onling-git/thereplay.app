// routes/adminTeamFeedRoutes.js
const express = require('express');
const router = express.Router();
const TeamRssFeedSubscription = require('../models/TeamRssFeedSubscription');
const RssFeed = require('../models/RssFeed');
const adminAuth = require('../middleware/adminAuth');

// All admin team feed routes require admin authentication (API key or admin user)
router.use(adminAuth(true));

// Get all teams with their optional feed subscriptions
router.get('/subscriptions', async (req, res) => {
  try {
    const { page = 1, limit = 20, search } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.max(1, Math.min(100, parseInt(limit))); // Cap at 100
    const skip = (pageNum - 1) * limitNum;

    const Team = require('../models/Team');

    // Build team query with indexes
    let teamQuery = {};
    if (search) {
      teamQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { slug: { $regex: search, $options: 'i' } }
      ];
    }

    // Parallel queries for performance
    const totalPromise = Team.countDocuments(teamQuery);
    const teamsPromise = Team.find(teamQuery)
      .select('_id name slug rssFeeds')
      .populate('rssFeeds.feedId', 'id name url priority')
      .sort({ name: 1 })
      .skip(skip)
      .limit(limitNum)
      .lean()
      .exec();

    const [total, teams] = await Promise.all([totalPromise, teamsPromise]);

    console.log(`Fetching ${teams.length} teams with rssFeeds (page ${pageNum})`);

    // Transform team data to match expected format
    const data = teams.map(team => ({
      id: team._id.toString(),
      teamId: team._id.toString(),
      teamSlug: team.slug || '',
      teamName: team.name || 'Unknown Team',
      enabled: true,
      feedCount: team.rssFeeds?.length || 0,
      feeds: (team.rssFeeds || []).map(f => ({
        feedId: f.feedId?._id?.toString() || f.feedId?.toString(),
        feedName: f.feedId?.name || 'Unknown Feed',
        feedUrl: f.feedId?.url || '',
        priority: f.priority || 0
      })),
      articleCount: 0,
      lastArticleFetch: null
    }));

    console.log(`Returning ${data.length} teams with feeds`);

    res.json({
      success: true,
      subscriptions: data,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    console.error('Error fetching subscriptions:', error.message, error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscriptions',
      message: error.message
    });
  }
});

// Add feed to team's RSS feeds
router.post('/subscriptions/:teamId/feeds', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { feedId, priority = 0 } = req.body;

    if (!feedId) {
      return res.status(400).json({
        success: false,
        error: 'Feed ID is required'
      });
    }

    const Team = require('../models/Team');

    // Verify feed exists
    const feed = await RssFeed.findById(feedId);
    if (!feed) {
      return res.status(404).json({
        success: false,
        error: 'Feed not found'
      });
    }

    // Add feed to team's rssFeeds array
    const team = await Team.findByIdAndUpdate(
      teamId,
      {
        $addToSet: {
          rssFeeds: { feedId, priority }
        }
      },
      { new: true }
    ).populate('rssFeeds.feedId', 'id name url priority');

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    res.json({
      success: true,
      message: 'Feed added to team',
      team: {
        id: team._id,
        name: team.name,
        feedCount: team.rssFeeds.length,
        feeds: team.rssFeeds.map(f => ({
          feedId: f.feedId?._id,
          feedName: f.feedId?.name,
          feedUrl: f.feedId?.url,
          priority: f.priority
        }))
      }
    });
  } catch (error) {
    console.error('Error adding feed to team:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add feed',
      message: error.message
    });
  }
});

// Remove feed from team's RSS feeds
router.delete('/subscriptions/:teamId/feeds/:feedId', async (req, res) => {
  try {
    const { teamId, feedId } = req.params;
    const Team = require('../models/Team');

    const team = await Team.findByIdAndUpdate(
      teamId,
      {
        $pull: {
          rssFeeds: { feedId }
        }
      },
      { new: true }
    ).populate('rssFeeds.feedId', 'id name url priority');

    if (!team) {
      return res.status(404).json({
        success: false,
        error: 'Team not found'
      });
    }

    res.json({
      success: true,
      message: 'Feed removed from team',
      team: {
        id: team._id,
        name: team.name,
        feedCount: team.rssFeeds.length,
        feeds: team.rssFeeds.map(f => ({
          feedId: f.feedId?._id,
          feedName: f.feedId?.name,
          feedUrl: f.feedId?.url,
          priority: f.priority
        }))
      }
    });
  } catch (error) {
    console.error('Error removing feed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove feed',
      message: error.message
    });
  }
});

// Get available feeds for assignment
router.get('/available-feeds', async (req, res) => {
  try {
    const feeds = await RssFeed.find({ enabled: true })
      .select('id name url priority scope')
      .sort({ priority: 1, name: 1 });

    res.json({
      success: true,
      feeds: feeds.map(f => ({
        id: f._id,
        feedId: f.id,
        name: f.name,
        url: f.url,
        priority: f.priority,
        scope: f.scope
      }))
    });
  } catch (error) {
    console.error('Error fetching feeds:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch feeds',
      message: error.message
    });
  }
});

module.exports = router;
