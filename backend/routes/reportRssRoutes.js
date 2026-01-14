const express = require('express');
const router = express.Router();
const { generateMatchReportsRss, getAvailableRssFeeds } = require('../utils/reportRssGenerator');

/**
 * GET /api/reports/rss
 * Generate RSS feed for all match reports
 * Query params:
 * - limit: number of reports (default: 20, max: 50)
 * - since: ISO date string to filter reports since
 */
router.get('/rss', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const since = req.query.since ? new Date(req.query.since) : null;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    console.log('[reports-rss] Generating all reports RSS feed', { limit, since });

    const rssXml = await generateMatchReportsRss({
      baseUrl,
      limit,
      since
    });

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.send(rssXml);

  } catch (error) {
    console.error('[reports-rss] Error generating all reports RSS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate RSS feed',
      error: error.message
    });
  }
});

/**
 * GET /api/reports/rss/:teamSlug
 * Generate RSS feed for specific team's match reports
 * Query params:
 * - limit: number of reports (default: 20, max: 50)
 * - since: ISO date string to filter reports since
 */
router.get('/rss/:teamSlug', async (req, res) => {
  try {
    const { teamSlug } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const since = req.query.since ? new Date(req.query.since) : null;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    console.log('[reports-rss] Generating team RSS feed', { teamSlug, limit, since });

    const rssXml = await generateMatchReportsRss({
      baseUrl,
      teamSlug,
      limit,
      since
    });

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.send(rssXml);

  } catch (error) {
    console.error('[reports-rss] Error generating team RSS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate team RSS feed',
      error: error.message
    });
  }
});

/**
 * GET /api/reports/rss/league/:leagueName
 * Generate RSS feed for specific league's match reports
 * Query params:
 * - limit: number of reports (default: 20, max: 50)
 * - since: ISO date string to filter reports since
 */
router.get('/rss/league/:leagueName', async (req, res) => {
  try {
    const league = decodeURIComponent(req.params.leagueName);
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const since = req.query.since ? new Date(req.query.since) : null;
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    console.log('[reports-rss] Generating league RSS feed', { league, limit, since });

    const rssXml = await generateMatchReportsRss({
      baseUrl,
      league,
      limit,
      since
    });

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.send(rssXml);

  } catch (error) {
    console.error('[reports-rss] Error generating league RSS:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate league RSS feed',
      error: error.message
    });
  }
});

/**
 * GET /api/reports/rss-feeds
 * Get available RSS feeds for discovery
 */
router.get('/rss-feeds', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    
    console.log('[reports-rss] Getting available RSS feeds');

    const feeds = await getAvailableRssFeeds(baseUrl);

    res.json({
      success: true,
      title: 'The Final Play - Match Reports RSS Feeds',
      description: 'Available RSS feeds for post-match analysis and reports',
      feeds,
      lastUpdated: new Date().toISOString(),
      totalFeeds: feeds.length
    });

  } catch (error) {
    console.error('[reports-rss] Error getting RSS feeds:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get available RSS feeds',
      error: error.message
    });
  }
});

/**
 * GET /api/reports/rss-discovery
 * RSS feed discovery document (JSON Feed format)
 * This is useful for news aggregators and RSS readers
 */
router.get('/rss-discovery', async (req, res) => {
  try {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const feeds = await getAvailableRssFeeds(baseUrl);

    // Convert to JSON Feed discovery format
    const discovery = {
      version: "https://jsonfeed.org/version/1.1",
      title: "The Final Play - Match Reports RSS Discovery",
      home_page_url: baseUrl,
      description: "Discover RSS feeds for football match reports and analysis",
      icon: `${baseUrl}/favicon.ico`,
      language: "en",
      feeds: feeds.map(feed => ({
        type: "rss",
        url: feed.url,
        title: feed.title,
        description: feed.description,
        categories: [feed.type],
        ...(feed.reportCount && { report_count: feed.reportCount }),
        ...(feed.lastReport && { last_updated: feed.lastReport })
      }))
    };

    res.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
    res.json(discovery);

  } catch (error) {
    console.error('[reports-rss] Error generating RSS discovery:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate RSS discovery',
      error: error.message
    });
  }
});

module.exports = router;