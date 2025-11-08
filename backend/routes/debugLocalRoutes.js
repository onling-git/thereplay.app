const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Team = require('../models/Team');
const Match = require('../models/Match');
const { inspectStatus } = require('../live/changeStreamBroadcaster');

// GET /api/debug-local/inspect/:teamSlug/:matchId
router.get('/inspect/:teamSlug/:matchId', async (req, res) => {
  try {
    const { teamSlug, matchId } = req.params;
    const team = await Team.findOne({ slug: String(teamSlug).toLowerCase().trim() }).lean().catch(() => null);
    const match = await Match.findOne({ match_id: Number(matchId) }).lean().catch(() => null);
    const cs = inspectStatus(matchId);
    res.json({
      mongooseReadyState: mongoose.connection?.readyState ?? null,
      changeStream: cs,
      team,
      match
    });
  } catch (e) {
    console.error('[debug-local] inspect error', e);
    res.status(500).json({ error: 'inspect failed', detail: e?.message || e });
  }
});

module.exports = router;
