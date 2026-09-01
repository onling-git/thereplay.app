const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const { generateReportV4, generateStagingReportV4, getStagingReportV4, promoteStagingReportV4 } = require('../controllers/reportControllerV4');

const router = express.Router();

router.post('/generate/:matchId/:teamSlug', adminAuth(true), generateReportV4);
router.post('/staging/:matchId/:teamSlug', adminAuth(true), generateStagingReportV4);
router.get('/staging/:matchId/:teamSlug', adminAuth(true), getStagingReportV4);
router.post('/staging/:matchId/:teamSlug/promote', adminAuth(true), promoteStagingReportV4);

module.exports = router;
