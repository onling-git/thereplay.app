const express = require('express');
const router = express.Router();
// IMPORTANT: do NOT put API-key auth here unless you also support query tokens.
// EventSource can't send custom headers by default.

// Delegate to the shared controller which already implements SSE and includes events
const { streamMatch } = require('../controllers/streamController');

router.get('/match/:matchId', streamMatch);

module.exports = router;
