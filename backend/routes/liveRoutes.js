// routes/liveRoutes.js
const express = require('express');
const router = express.Router();
const apiKey = require('../middleware/apiKey');
const { liveStart, liveStop, liveStatus, liveAdd, liveRemove } = require('../controllers/liveController');

// all live controls require admin key
router.post('/start', apiKey(true), liveStart);
router.post('/stop', apiKey(true), liveStop);
router.get('/status', apiKey(true), liveStatus);
router.post('/add/:fixtureId', apiKey(true), liveAdd);
router.post('/remove/:fixtureId', apiKey(true), liveRemove);

module.exports = router;
