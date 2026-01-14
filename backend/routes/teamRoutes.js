// routes/teamRoutes.js
const express = require('express');
const router = express.Router();
const apiKey = require('../middleware/apiKey'); // ensure this exists

const { recomputeTeamSnapshot, listTeams, recomputeAllTeams, getTeamSnapshot, getTeamWithCurrentMatches, getCountries } = require('../controllers/teamController');

// get countries with teams (public)
router.get('/countries', getCountries);

// list teams (public)
router.get('/', listTeams);

// get single team snapshot (public)
router.get('/:teamSlug', getTeamSnapshot);

// get team with dynamically computed current match info (public)
router.get('/:teamSlug/current', getTeamWithCurrentMatches);

// admin-protected recompute single team
router.post('/:teamSlug/recompute', apiKey(true), recomputeTeamSnapshot);

// admin-protected bulk recompute
router.post('/recompute-all', apiKey(true), recomputeAllTeams);

module.exports = router;
