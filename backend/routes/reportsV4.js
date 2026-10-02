const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const { generateReportV4, generateBothReportsV4, generateStagingReportV4, getStagingReportV4, promoteStagingReportV4 } = require('../controllers/reportControllerV4');
const { syncFinishedMatch } = require('../controllers/matchSyncController');

const router = express.Router();

router.post('/generate/:matchId/:teamSlug', adminAuth(true), generateReportV4);
router.post('/:teamSlug/match/:matchId/generate-both', adminAuth(true), async (req, res) => {
	try {
		const matchId = Number(req.params.matchId);
		try {
			await syncFinishedMatch(matchId, { forFinished: true });
		} catch (error) {
			console.warn('syncFinishedMatch before V4 generate-both failed (continuing):', error.message);
		}
		return await generateBothReportsV4(req, res);
	} catch (error) {
		console.error('generateBothV4 failed:', error);
		return res.status(500).json({ error: 'Failed to generate both V4 reports', detail: error.message });
	}
});
router.post('/staging/:matchId/:teamSlug', adminAuth(true), generateStagingReportV4);
router.get('/staging/:matchId/:teamSlug', adminAuth(true), getStagingReportV4);
router.post('/staging/:matchId/:teamSlug/promote', adminAuth(true), promoteStagingReportV4);

module.exports = router;
