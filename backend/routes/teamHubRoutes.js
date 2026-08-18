const express = require('express');
const authMiddleware = require('../middleware/auth');
const teamHubController = require('../controllers/teamHubController');

const router = express.Router();

// Public discussion reads
router.get('/:teamSlug/hub/discussions', authMiddleware.optionalAuth, teamHubController.listDiscussions);
router.get('/:teamSlug/hub/discussions/:discussionId', authMiddleware.optionalAuth, teamHubController.getDiscussion);

// Authenticated write operations
router.post('/:teamSlug/hub/discussions', authMiddleware.protect, teamHubController.createDiscussion);
router.post('/:teamSlug/hub/discussions/:discussionId/comments', authMiddleware.protect, teamHubController.createComment);
router.post('/:teamSlug/hub/discussions/:discussionId/replies', authMiddleware.protect, teamHubController.createReply);

router.patch('/:teamSlug/hub/discussions/:discussionId', authMiddleware.protect, teamHubController.updateDiscussion);
router.delete('/:teamSlug/hub/discussions/:discussionId', authMiddleware.protect, teamHubController.deleteDiscussion);
router.post('/:teamSlug/hub/discussions/:discussionId/vote', authMiddleware.protect, teamHubController.voteDiscussion);

router.patch('/:teamSlug/hub/comments/:commentId', authMiddleware.protect, teamHubController.updateComment);
router.delete('/:teamSlug/hub/comments/:commentId', authMiddleware.protect, teamHubController.deleteComment);
router.post('/:teamSlug/hub/comments/:commentId/vote', authMiddleware.protect, teamHubController.voteComment);

router.post('/:teamSlug/hub/reports', authMiddleware.protect, teamHubController.reportContent);

module.exports = router;
