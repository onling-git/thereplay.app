const express = require('express');
const router = express.Router();
const apiKey = require('../middleware/apiKey');

const {
  syncFixture,
  syncTeamWindow,
  syncLiveNow,
  syncByDate,
  syncCatalogAll
} = require('../controllers/syncController');

const { syncLeagueWindow } = require('../controllers/syncController');

router.post('/fixture/:fixtureId', apiKey(true), syncFixture);
router.post('/team/:teamSlug/window', apiKey(true), syncTeamWindow);
router.post('/league/:leagueId/window', apiKey(true), syncLeagueWindow);
router.post('/live-now', apiKey(true), syncLiveNow);
router.post('/date/:y/:m/:d', apiKey(true), syncByDate);
router.post('/catalog/all', apiKey(true), syncCatalogAll);

module.exports = router;
