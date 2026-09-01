// routes/reportsV3.js
// V3 routes kept parallel to V2 for safe side-by-side testing.

const express = require('express');
const router = express.Router();
const adminAuth = require('../middleware/adminAuth');
const {
  generateReportV3,
  generateStagingReportV3,
  getStagingReportV3,
  promoteStagingReportV3
} = require('../controllers/reportControllerV3');

/**
 * @route   POST /api/reports/v3/generate/:matchId/:teamSlug
 * @desc    Generate (or regenerate) a V3 report.
 * @query   debug=true - include Run 1 interpretation + Run 2 editorial plan
 * @access  Private (API key or admin user)
 */
router.post('/generate/:matchId/:teamSlug', adminAuth(true), generateReportV3);

/**
 * @route   POST /api/reports/v3/staging/:matchId/:teamSlug
 * @desc    Generate a V3 draft into ReportStaging only.
 * @query   debug=true - include Run 1 interpretation + Run 2 editorial plan
 * @access  Private (API key or admin user)
 */
router.post('/staging/:matchId/:teamSlug', adminAuth(true), generateStagingReportV3);

/**
 * @route   GET /api/reports/v3/staging/:matchId/:teamSlug
 * @desc    Fetch current V3 staging draft if present.
 * @access  Private (API key or admin user)
 */
router.get('/staging/:matchId/:teamSlug', adminAuth(true), getStagingReportV3);

/**
 * @route   POST /api/reports/v3/staging/:matchId/:teamSlug/promote
 * @desc    Promote V3 staging draft into live Report collection.
 * @access  Private (API key or admin user)
 */
router.post('/staging/:matchId/:teamSlug/promote', adminAuth(true), promoteStagingReportV3);

module.exports = router;
