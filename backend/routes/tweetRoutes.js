// routes/tweetRoutes.js
const express = require('express');
const router = express.Router();
const apiKey = require('../middleware/apiKey');
const {
  getTeamTweets,
  getMatchTweets,
  collectTeamTweets,
  collectMatchTweets,
  getTweetStats
} = require('../controllers/tweetController');

// Public routes (no API key required)

/**
 * GET /api/tweets/team/:teamSlug
 * Get tweets for a specific team
 * Query params: limit, skip, sentiment, matchRelated, since, until
 */
router.get('/team/:teamSlug', getTeamTweets);

/**
 * GET /api/tweets/match/:matchId
 * Get tweets for a specific match
 * Query params: limit, skip
 */
router.get('/match/:matchId', getMatchTweets);

/**
 * GET /api/tweets/stats
 * Get overall tweet collection statistics
 */
router.get('/stats', getTweetStats);

// Protected routes (require API key)

/**
 * POST /api/tweets/collect/team/:teamSlug
 * Collect tweets for a specific team
 * Body: { hours, maxTweets, queryType }
 */
router.post('/collect/team/:teamSlug', collectTeamTweets);

/**
 * POST /api/tweets/collect/match/:matchId
 * Collect tweets for a specific match
 * Body: { preMatchHours, postMatchHours, maxTweets, queryType }
 */
router.post('/collect/match/:matchId', collectMatchTweets);

/**
 * POST /api/tweets/collect/bulk
 * Bulk collect tweets for multiple teams or matches
 */
router.post('/collect/bulk', async (req, res) => {
  try {
    const { 
      teams = [], 
      matches = [], 
      hours = 24, 
      maxTweetsPerTarget = 25,
      concurrent = 3 
    } = req.body;

    const results = {
      teams: [],
      matches: [],
      errors: []
    };

    // Process teams in batches to avoid overwhelming the API
    const processBatch = async (items, processor, type) => {
      for (let i = 0; i < items.length; i += concurrent) {
        const batch = items.slice(i, i + concurrent);
        const promises = batch.map(async (item) => {
          try {
            const result = await processor(item);
            results[type].push(result);
          } catch (error) {
            results.errors.push({
              type,
              item,
              error: error.message
            });
          }
        });
        
        await Promise.allSettled(promises);
        
        // Add delay between batches to respect rate limits
        if (i + concurrent < items.length) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    };

    // Process teams
    if (teams.length > 0) {
      await processBatch(teams, async (teamSlug) => {
        const mockReq = { 
          params: { teamSlug }, 
          body: { hours, maxTweets: maxTweetsPerTarget }
        };
        const mockRes = {
          json: (data) => data,
          status: () => mockRes
        };
        
        return await collectTeamTweets(mockReq, mockRes);
      }, 'teams');
    }

    // Process matches
    if (matches.length > 0) {
      await processBatch(matches, async (matchId) => {
        const mockReq = { 
          params: { matchId }, 
          body: { 
            preMatchHours: 2, 
            postMatchHours: 3, 
            maxTweets: maxTweetsPerTarget 
          }
        };
        const mockRes = {
          json: (data) => data,
          status: () => mockRes
        };
        
        return await collectMatchTweets(mockReq, mockRes);
      }, 'matches');
    }

    res.json({
      success: true,
      summary: {
        teams_processed: results.teams.length,
        matches_processed: results.matches.length,
        errors: results.errors.length
      },
      results
    });

  } catch (error) {
    console.error('Bulk collection error:', error);
    res.status(500).json({ error: 'Bulk collection failed', detail: error.message });
  }
});

module.exports = router;