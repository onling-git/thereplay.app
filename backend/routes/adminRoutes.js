// routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const apiKey = require('../middleware/apiKey');
const { requireBodyFields } = require('../middleware/validate');

const {
  backfillMatchSlugs,
  seedFutureMatch,
} = require('../controllers/adminController');

// Secure admin routes with API key
router.post('/backfill/match-slugs', apiKey(true), backfillMatchSlugs);

router.post(
  '/seed/future-match',
  apiKey(true),
  requireBodyFields('home_team', 'away_team', 'kickoffISO'),
  seedFutureMatch
);

module.exports = router;
