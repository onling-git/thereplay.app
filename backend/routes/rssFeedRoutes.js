const express = require('express');
const router = express.Router();
const {
  getRssFeeds,
  getRssFeed,
  createRssFeed,
  updateRssFeed,
  deleteRssFeed,
  toggleRssFeed,
  getRssFeedStats
} = require('../controllers/rssFeedController');

// Get statistics
router.get('/stats', getRssFeedStats);

// Get all RSS feeds (with optional filtering)
router.get('/', getRssFeeds);

// Get specific RSS feed
router.get('/:id', getRssFeed);

// Create new RSS feed
router.post('/', createRssFeed);

// Update RSS feed
router.put('/:id', updateRssFeed);

// Toggle RSS feed enabled/disabled
router.put('/:id/toggle', toggleRssFeed);

// Delete RSS feed
router.delete('/:id', deleteRssFeed);

module.exports = router;