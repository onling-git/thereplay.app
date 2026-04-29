// routes/fixturesRoutes.js
const express = require('express');
const router = express.Router();
const { getAllFixtures, getFixtureCountries, getFixtureLeagues } = require('../controllers/fixturesController');

// Get all fixtures organized by country and league
router.get('/', getAllFixtures);

// Get countries that have fixtures
router.get('/countries', getFixtureCountries);

// Get leagues that have fixtures (optionally filtered by country)
router.get('/leagues', getFixtureLeagues);

module.exports = router;