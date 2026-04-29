// routes/adminRoutes.js
const express = require('express');
const router = express.Router();

const adminAuth = require('../middleware/adminAuth');
const { requireBodyFields } = require('../middleware/validate');

const {
  backfillMatchSlugs,
  seedFutureMatch,
} = require('../controllers/adminController');

// All admin routes require admin authentication (API key or admin user)
router.use(adminAuth(true));

// Secure admin routes
router.post('/backfill/match-slugs', backfillMatchSlugs);

router.post(
  '/seed/future-match',
  requireBodyFields('home_team', 'away_team', 'kickoffISO'),
  seedFutureMatch
);

module.exports = router;
