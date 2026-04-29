// routes/teamNewsRoutes.js
const express = require('express');
const router = express.Router();
const { getTeamArticles } = require('../utils/teamNewsAggregator');

/**
 * GET /api/teams/:teamId/news
 * Fetch news articles for a specific team
 */
router.get('/:teamId/news', async (req, res) => {
  try {
    const { teamId } = req.params;
    const { limit = 20, cache = true } = req.query;

    if (!teamId || isNaN(teamId)) {
      return res.status(400).json({
        success: false,
        error: 'Valid team ID is required'
      });
    }

    const articles = await getTeamArticles(
      parseInt(teamId),
      parseInt(limit),
      cache === 'true'
    );

    res.json({
      success: true,
      teamId: parseInt(teamId),
      articleCount: articles.length,
      articles
    });
  } catch (error) {
    console.error('Error fetching team news:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch team news',
      message: error.message
    });
  }
});

module.exports = router;
