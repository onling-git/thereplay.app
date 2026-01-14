// routes/reportRoutes.js or wherever you generate reports
const express = require('express');
const router = express.Router();
const { generateReport } = require('../controllers/reportController');
const { syncFinishedMatch } = require('../controllers/matchSyncController');
const apiKey = require('../middleware/apiKey');

// POST /api/reports/:teamSlug/match/:matchId/generate
router.post('/:teamSlug/match/:matchId/generate', async (req, res) => {
  const matchId = Number(req.params.matchId);
  try {
    // Ensure ratings & stats are in DB before generating report
  await syncFinishedMatch(matchId, { forFinished: true });

    // Now call the existing report generation
    return generateReport(req, res);
  } catch (err) {
    console.error('generateReport failed:', err);
    res.status(500).json({ error: 'Failed to generate report', detail: err.message });
  }
});

// POST /api/reports/:teamSlug/match/:matchId/generate-both
router.post('/:teamSlug/match/:matchId/generate-both', apiKey(true), async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    // ensure we sync finished match data first (ratings/stats)
    const { syncFinishedMatch } = require('../controllers/matchSyncController');
      try {
      await syncFinishedMatch(matchId, { forFinished: true });
    } catch (e) {
      console.warn('syncFinishedMatch before generate-both failed (continuing):', e.message);
    }

    const { generateBothReports } = require('../controllers/reportController');
    const reports = await generateBothReports(matchId);
    return res.json({ ok: true, reports });
  } catch (err) {
    console.error('generateBoth failed:', err);
    res.status(500).json({ error: 'Failed to generate both reports', detail: err.message });
  }
});

module.exports = router;
