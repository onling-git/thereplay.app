// routes/favoriteMatchRoutes.js
const express = require('express');
const favoriteMatchController = require('../controllers/favoriteMatchController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware.protect);

// Get user's favorite matches
router.get('/', favoriteMatchController.getFavoriteMatches);

// Get favorite matches count/stats
router.get('/count', favoriteMatchController.getFavoriteMatchesCount);

// Check if a specific match is favorited
router.get('/check/:match_id', favoriteMatchController.checkFavoriteStatus);

// Add a match to favorites
router.post('/', favoriteMatchController.addFavoriteMatch);

// Remove a match from favorites
router.delete('/:match_id', favoriteMatchController.removeFavoriteMatch);

module.exports = router;