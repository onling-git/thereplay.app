// // routes/matchRoutes.js
// const express = require("express");
// const router = express.Router();

// const {
//   getLastMatchByTeam,
//   getMatchByTeamAndId,
//   getMatchReport,
//   getUpcomingMatch,
//   setMatchReport,
//   listLiveMatches,
//   listTeamLiveMatches,
// } = require("../controllers/matchController");

// const {
//   listMatches,
//   listRecent,
//   listUpcoming,
// } = require("../controllers/matchListController");

// const {
//   requireNumericParam,
//   requireSlugParam,
//   limitGuard,
//   validateDateWindow,
// } = require("../middleware/validate");

// // Core routes (validate team slug; validate numeric ID where applicable)
// router.get(
//   "/:teamName/last-match",
//   requireSlugParam("teamName"),
//   getLastMatchByTeam
// );

// router.get(
//   "/:teamName/match/:matchId",
//   requireSlugParam("teamName"),
//   requireNumericParam("matchId"),
//   getMatchByTeamAndId
// );

// router.get(
//   "/:teamName/match/:matchId/report",
//   requireSlugParam("teamName"),
//   requireNumericParam("matchId"),
//   getMatchReport
// );

// router.get(
//   "/:teamName/upcoming",
//   requireSlugParam("teamName"),
//   getUpcomingMatch
// );

// // Updating report
// router.post(
//   "/:teamName/match/:matchId/report",
//   requireSlugParam("teamName"),
//   requireNumericParam("matchId"),
//   setMatchReport
// );

// // Listing routes
// router.get(
//   "/:teamName/matches",
//   requireSlugParam("teamName"),
//   validateDateWindow("from", "to"),
//   limitGuard(100, 20),
//   listMatches
// );

// /**
//  * @openapi
//  * /api/{teamName}/matches/recent:
//  *   get:
//  *     tags: [Matches]
//  *     summary: List recent matches for a team
//  *     parameters:
//  *       - in: path
//  *         name: teamSlug
//  *         required: true
//  *         schema: { type: string }
//  *         example: west-ham-united
//  *       - in: query
//  *         name: limit
//  *         required: false
//  *         schema: { type: integer, minimum: 1, maximum: 50, default: 5 }
//  *     responses:
//  *       200:
//  *         description: Recent matches
//  *         content:
//  *           application/json:
//  *             schema:
//  *               type: array
//  *               items: { $ref: '#/components/schemas/Match' }
//  *       404:
//  *         description: Not found
//  *         content:
//  *           application/json:
//  *             schema: { $ref: '#/components/schemas/ErrorResponse' }
//  */

// router.get(
//   "/:teamName/matches/recent",
//   requireSlugParam("teamName"),
//   limitGuard(50, 5),
//   listRecent
// );

// router.get(
//   "/:teamName/matches/upcoming",
//   requireSlugParam("teamName"),
//   limitGuard(50, 3),
//   listUpcoming
// );

// router.get(
//   "/live",
//   require("./../middleware/validate").limitGuard(200, 50),
//   listLiveMatches
// );

// router.get(
//   "/:teamName/live",
//   requireSlugParam("teamName"),
//   listTeamLiveMatches
// );

// module.exports = router;


// routes/matchRoutes.js
const express = require('express');
const router = express.Router();

const {
  getLastMatchByTeam,
  getMatchByTeamAndId,
  getMatchReport,
  getUpcomingMatch,
  setMatchReport,
} = require('../controllers/matchController');

// (Optional) tiny validators – comment these if you don’t have them yet
const requireSlugParam = (key) => (req, res, next) => {
  const v = String(req.params[key] || '').trim().toLowerCase();
  if (!v) return res.status(400).json({ error: `Missing slug param: ${key}` });
  next();
};
const requireNumericParam = (key) => (req, res, next) => {
  const v = Number(req.params[key]);
  if (!Number.isFinite(v)) return res.status(400).json({ error: `Invalid number param: ${key}` });
  next();
};

// Routes



router.get('/:teamName/last-match',
  requireSlugParam('teamName'),
  getLastMatchByTeam
);

router.get('/:teamName/match/:matchId',
  requireSlugParam('teamName'),
  requireNumericParam('matchId'),
  getMatchByTeamAndId
);

router.get('/:teamName/match/:matchId/report',
  requireSlugParam('teamName'),
  requireNumericParam('matchId'),
  getMatchReport
);

router.get('/:teamName/upcoming',
  requireSlugParam('teamName'),
  getUpcomingMatch
);

router.post('/:teamName/match/:matchId/report',
  requireSlugParam('teamName'),
  requireNumericParam('matchId'),
  setMatchReport
);

// Generic match endpoint (no team context required)
router.get('/matches/:matchId',
  requireNumericParam('matchId'),
  async (req, res) => {
    try {
      const Match = require('../models/Match');
      const matchId = Number(req.params.matchId);
      
      const match = await Match.findOne({ match_id: matchId }).lean();
      
      if (!match) {
        return res.status(404).json({ error: 'Match not found' });
      }
      
      res.json(match);
    } catch (err) {
      console.error('Generic match fetch error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
