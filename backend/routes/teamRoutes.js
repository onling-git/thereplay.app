// routes/teamRoutes.js
const express = require('express');
const router = express.Router();
require('../middleware/publicCoverage').protectRouter(router, { teams: ['teamSlug'] });
const apiKey = require('../middleware/apiKey'); // ensure this exists

const { recomputeTeamSnapshot, listTeams, recomputeAllTeams, getTeamSnapshot, getTeamWithCurrentMatches, getCountries, getTeamCompetitions, getTeamFixtures, getTeamSeasonStatistics } = require('../controllers/teamController');

// get countries with teams (public)
router.get('/countries', getCountries);
router.get('/coverage', (req, res) => res.json({
  teamIds: req.coverage.teamIds,
  competitionIds: req.coverage.competitionIds,
  teams: req.coverage.teams.map(team => ({ ...team, supported: true }))
}));

// list teams (public)
router.get('/', listTeams);

// get recent and upcoming team fixtures (public)
router.get('/:teamSlug/fixtures', getTeamFixtures);

router.get('/:teamSlug/statistics', getTeamSeasonStatistics);

// get single team snapshot (public)
router.get('/:teamSlug', getTeamSnapshot);

// get team with dynamically computed current match info (public)
router.get('/:teamSlug/current', getTeamWithCurrentMatches);

// get team competitions (cup competitions excluding league) (public)
router.get('/:teamSlug/competitions', getTeamCompetitions);

// admin-protected recompute single team
router.post('/:teamSlug/recompute', apiKey(true), recomputeTeamSnapshot);

// admin-protected bulk recompute
router.post('/recompute-all', apiKey(true), recomputeAllTeams);

module.exports = router;
