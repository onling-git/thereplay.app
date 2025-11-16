const express = require('express');
const router = express.Router();
const { listLeagues, getLeagueFixtures } = require('../controllers/leagueController');

// Public endpoint to list leagues discovered in the DB
router.get('/', listLeagues);

// Get fixtures for a specific league
router.get('/:leagueId/fixtures', getLeagueFixtures);

module.exports = router;
