const express = require('express');
const router = express.Router();
const apiKey = require('../middleware/apiKey');
const { syncFullSeason } = require('../controllers/syncOrchestratorController');

router.post('/full-season', apiKey(true), syncFullSeason);

module.exports = router;
