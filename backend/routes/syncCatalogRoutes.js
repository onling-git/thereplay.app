const express = require('express');
const router = express.Router();
const apiKey = require('../middleware/apiKey');
const { syncAllTeams } = require('../controllers/syncCatalogController');

// Admin-only (protect with API key)
router.post('/teams', apiKey(true), syncAllTeams);

module.exports = router;
