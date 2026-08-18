const express = require('express');
const adminAuth = require('../middleware/adminAuth');
const teamHubController = require('../controllers/teamHubController');

const router = express.Router();

router.use(adminAuth(true));

router.get('/reports', teamHubController.adminListReports);
router.post('/reports/:reportId/dismiss', teamHubController.adminDismissReport);

router.post('/content/:targetType/:targetId/hide', teamHubController.adminHideContent);
router.post('/content/:targetType/:targetId/delete', teamHubController.adminDeleteContent);

router.post('/users/:userId/restrict', teamHubController.adminRestrictUser);
router.post('/users/:userId/suspend', teamHubController.adminSuspendUser);
router.post('/users/:userId/ban', teamHubController.adminBanUser);
router.post('/users/:userId/unrestrict', teamHubController.adminUnrestrictUser);
router.post('/users/:userId/unsuspend', teamHubController.adminUnsuspendUser);
router.post('/users/:userId/unban', teamHubController.adminUnbanUser);

module.exports = router;
