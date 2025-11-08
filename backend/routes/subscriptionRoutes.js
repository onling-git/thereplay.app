const express = require('express');
const subscriptionController = require('../controllers/subscriptionController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Public routes
router.get('/plans', subscriptionController.getPlans);

// Webhook route (must be before body parsing middleware)
router.post('/webhook', 
  express.raw({ type: 'application/json' }), 
  subscriptionController.handleWebhook
);

// Routes that require authentication
router.use(authMiddleware.protect);

// Subscription management routes
router.post('/checkout', subscriptionController.createCheckoutSession);
router.get('/success', subscriptionController.handleSubscriptionSuccess);
router.get('/status', subscriptionController.getSubscriptionStatus);

// Subscription modification routes
router.post('/cancel', subscriptionController.cancelSubscription);
router.post('/reactivate', subscriptionController.reactivateSubscription);

// Billing portal
router.post('/billing-portal', subscriptionController.createBillingPortalSession);

module.exports = router;