// routes/reportsV2.js
// Example route integration for the new pipeline

const express = require('express');
const router = express.Router();
const { generateReportV2, batchGenerateReports, generateBothReportsV2 } = require('../controllers/reportControllerV2');
const { handleMatchStatusWebhook } = require('../webhooks/matchStatusWebhook');
const apiKey = require('../middleware/apiKey');
const { syncFinishedMatch } = require('../controllers/matchSyncController');

/**
 * @route   POST /api/reports/v2/generate/:matchId/:teamSlug
 * @desc    Generate a match report using the 2-step pipeline
 * @query   debug=true - Include Step 1 interpretation in response
 * @access  Private (add auth middleware as needed)
 */
router.post('/generate/:matchId/:teamSlug', generateReportV2);

/**
 * @route   POST /api/reports/v2/:teamSlug/match/:matchId/generate-both
 * @desc    Generate both home and away reports for a match (cron-compatible)
 * @access  Private (admin key required)
 */
router.post('/:teamSlug/match/:matchId/generate-both', apiKey(true), async (req, res) => {
  try {
    const matchId = Number(req.params.matchId);
    
    // Ensure we sync finished match data first (ratings/stats)
    try {
      await syncFinishedMatch(matchId, { forFinished: true });
    } catch (e) {
      console.warn('syncFinishedMatch before generate-both failed (continuing):', e.message);
    }

    // Generate both reports using v2 controller
    const reports = await generateBothReportsV2(matchId);
    return res.json({ ok: true, reports });
  } catch (err) {
    console.error('generateBothV2 failed:', err);
    res.status(500).json({ error: 'Failed to generate both reports', detail: err.message });
  }
});

/**
 * @route   POST /api/reports/v2/batch
 * @desc    Generate reports for multiple matches
 * @body    { matchIds: [123456, 123457] }
 * @access  Private (add auth middleware as needed)
 */
router.post('/batch', batchGenerateReports);

/**
 * @route   POST /api/webhooks/match-status
 * @desc    Webhook endpoint for match status updates
 * @body    { match_id: 123456, status: "Finished", timestamp: "..." }
 * @access  Public (add webhook signature verification as needed)
 */
router.post('/webhook/match-status', handleMatchStatusWebhook);

module.exports = router;

// ===== INTEGRATION EXAMPLE =====
// In your main app.js or server.js:
//
// const reportsV2Routes = require('./routes/reportsV2');
// app.use('/api/reports/v2', reportsV2Routes);
//
// This creates:
// - POST /api/reports/v2/generate/:matchId/:teamSlug
// - POST /api/reports/v2/batch
// - POST /api/reports/v2/webhook/match-status
