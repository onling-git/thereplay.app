const express = require('express');
const router = express.Router();
const { getNews, getNewsForLeague } = require('../controllers/newsController');

// Get general news
router.get('/', getNews);

// Get news for a specific league
router.get('/league/:leagueId', getNewsForLeague);

module.exports = router;