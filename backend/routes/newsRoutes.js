const express = require('express');
const router = express.Router();
const { 
  getNews, 
  getNewsForLeague, 
  getNewsForTeam,
  searchNews,
  getNewsMetadata,
  getNewsRss, 
  testRssAggregator 
} = require('../controllers/newsController');

// Get metadata (leagues, teams available for filtering)
router.get('/metadata', getNewsMetadata);

// Search news with multiple filters
router.get('/search', searchNews);

// Test RSS aggregator
router.get('/test-rss', testRssAggregator);

// Get general news
router.get('/', getNews);

// Get news for a specific league
router.get('/league/:leagueId', getNewsForLeague);

// Get news for a specific team
router.get('/team/:teamId', getNewsForTeam);

// RSS feed (optionally pass ?leagueId= or use league-specific path)
router.get('/rss', getNewsRss);
router.get('/league/:leagueId/rss', (req, res) => {
	// forward to getNewsRss preserving leagueId as query for simplicity
	req.query.leagueId = req.params.leagueId;
	return getNewsRss(req, res);
});

module.exports = router;