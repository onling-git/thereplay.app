// routes/reportRoutes.js or wherever you generate reports
const express = require('express');
const router = express.Router();
const { generateReportV4, generateBothReportsV4 } = require('../controllers/reportControllerV4');
const { syncFinishedMatch } = require('../controllers/matchSyncController');
const apiKey = require('../middleware/apiKey');

// POST /api/reports/:teamSlug/match/:matchId/generate
router.post('/:teamSlug/match/:matchId/generate', apiKey(true), async (req, res) => {
  const matchId = Number(req.params.matchId);
  try {
    require('../services/reportGenerationPolicy').assertGenerationEnabled();
    const match = await require('../services/coveragePolicy').assertPublicMatch(matchId);
    await require('../services/reportGenerationPolicy').assertEnglishReportTeam(match, req.params.teamSlug);
    // Ensure ratings & stats are in DB before generating report
  await syncFinishedMatch(matchId, { forFinished: true });

    return generateReportV4(req, res);
  } catch (err) {
    console.error('generateReport failed:', err);
    res.status(err.status || 500).json({ error: 'Failed to generate report', detail: err.message });
  }
});

// POST /api/reports/:teamSlug/match/:matchId/generate-both
router.post('/:teamSlug/match/:matchId/generate-both', apiKey(true), async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    require('../services/reportGenerationPolicy').assertGenerationEnabled();
    await require('../services/coveragePolicy').assertPublicMatch(matchId);
    // ensure we sync finished match data first (ratings/stats)
    const { syncFinishedMatch } = require('../controllers/matchSyncController');
      try {
      await syncFinishedMatch(matchId, { forFinished: true });
    } catch (e) {
      console.warn('syncFinishedMatch before generate-both failed (continuing):', e.message);
    }

    return generateBothReportsV4(req, res);
  } catch (err) {
    console.error('generateBoth failed:', err);
    res.status(err.status || 500).json({ error: 'Failed to generate both reports', detail: err.message });
  }
});

module.exports = router;
