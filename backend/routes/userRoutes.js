const express = require('express');
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Public routes (no authentication required)
router.post('/register', userController.register);
router.post('/login', userController.login);
router.post('/logout', userController.logout);
router.post('/forgot-password', userController.forgotPassword);
router.patch('/reset-password', userController.resetPassword);
router.get('/verify-email/:token', userController.verifyEmail);

// Team preferences routes that work for both authenticated and anonymous users
router.get('/team-preferences', 
  authMiddleware.optionalAuth, 
  userController.getTeamPreferences
);

// Anonymous user team preferences (using session/cookies)
router.post('/team-preferences/anonymous', 
  userController.setAnonymousTeamPreferences
);

// Routes that require authentication
router.use(authMiddleware.protect); // All routes after this middleware require authentication

// User profile routes
router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);
router.delete('/me', userController.deleteAccount);

// Password management
router.patch('/change-password', userController.changePassword);

// Team preferences for authenticated users
router.patch('/team-preferences', userController.updateTeamPreferences);

// Payment methods routes
router.route('/payment-methods')
  .get(userController.getPaymentMethods)
  .post(userController.addPaymentMethod);

router.route('/payment-methods/:methodId')
  .patch(userController.updatePaymentMethod)
  .delete(userController.deletePaymentMethod);

// Billing and subscription routes
router.get('/billing-history', userController.getBillingHistory);

router.route('/subscription')
  .get(userController.getSubscription)
  .patch(userController.updateSubscription);

// Admin routes (require admin role)
router.use(authMiddleware.restrictTo('admin', 'super_admin'));
router.get('/admin/all-users', userController.getAllUsers);

module.exports = router;