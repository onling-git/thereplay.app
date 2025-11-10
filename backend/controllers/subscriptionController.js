const { stripe, stripeHelpers, SUBSCRIPTION_PLANS } = require('../utils/stripe');
const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');

// Helper function to map Stripe subscription to our internal format
const mapStripeSubscriptionToInternal = (stripeSubscription) => {
  const planType = stripeSubscription.metadata?.plan || 'monthly';
  const plan = SUBSCRIPTION_PLANS[planType];
  const isActive = stripeSubscription.status === 'active';
  
  return {
    plan: planType === 'yearly' ? 'pro' : 'premium', // Map to internal plan names
    status: stripeSubscription.status === 'active' ? 'active' : 
            stripeSubscription.status === 'canceled' ? 'cancelled' :
            stripeSubscription.status === 'past_due' ? 'past_due' :
            stripeSubscription.status === 'unpaid' ? 'unpaid' :
            stripeSubscription.status === 'trialing' ? 'trialing' : 'inactive',
    stripe_subscription_id: stripeSubscription.id,
    stripe_customer_id: stripeSubscription.customer,
    current_period_start: new Date(stripeSubscription.current_period_start * 1000),
    current_period_end: new Date(stripeSubscription.current_period_end * 1000),
    cancel_at_period_end: stripeSubscription.cancel_at_period_end,
    features: {
      live_scores: true,
      premium_stats: isActive && (plan?.features?.premium_stats || false),
      multiple_teams: isActive && (plan?.features?.multiple_teams || false),
      ad_free: isActive && (plan?.features?.ad_free || false), // Only ad-free for active subscribers
      push_notifications: isActive && (plan?.features?.push_notifications || false),
      exclusive_content: isActive && (plan?.features?.exclusive_content || false),
      api_access: isActive && (plan?.features?.api_access || false)
    }
  };
};

// Get available subscription plans and their prices
const getPlans = catchAsync(async (req, res, next) => {
  try {
    // Get price IDs from Stripe configuration
    const prices = stripeHelpers.getPriceIds();
    
    const plans = Object.keys(SUBSCRIPTION_PLANS).map(key => ({
      id: key,
      name: SUBSCRIPTION_PLANS[key].name,
      interval: SUBSCRIPTION_PLANS[key].interval,
      currency: SUBSCRIPTION_PLANS[key].currency,
      features: SUBSCRIPTION_PLANS[key].features,
      price_id: prices[key]
    }));

    res.status(200).json({
      status: 'success',
      data: {
        plans
      }
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve subscription plans',
      error: error.message
    });
  }
});

// Create checkout session for subscription
const createCheckoutSession = catchAsync(async (req, res, next) => {
  try {
    console.log('[subscription] createCheckoutSession called with:', { priceId: req.body.priceId, plan: req.body.plan, userId: req.user?.id });
    
    const { priceId, plan } = req.body;
    const user = await User.findById(req.user.id);
    
    console.log('[subscription] User found:', !!user, user ? { id: user._id, email: user.email, stripe_customer_id: user.stripe_customer_id } : 'NO USER');

    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    // Create or get Stripe customer
    let customerId = user.stripe_customer_id;
    
    if (!customerId) {
      console.log('[subscription] Creating Stripe customer for:', user.email);
      try {
        const customer = await stripeHelpers.createCustomer({
          id: user._id,
          email: user.email,
          first_name: user.first_name,
          surname: user.surname
        });
        
        console.log('[subscription] Stripe customer created:', customer.id);
        customerId = customer.id;
      } catch (stripeError) {
        console.error('[subscription] Failed to create Stripe customer:', stripeError);
        throw stripeError;
      }
      
      // Update user with Stripe customer ID
      user.stripe_customer_id = customerId;
      await user.save({ validateBeforeSave: false });
    }

    // Create checkout session
    console.log('[subscription] Creating checkout session with:', { customerId, priceId, plan });
    let session;
    try {
      session = await stripeHelpers.createCheckoutSession(
        customerId,
        priceId,
        `${process.env.SELF_BASE}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
        `${process.env.SELF_BASE}/subscription/cancel`
      );
      console.log('[subscription] Checkout session created:', session.id);
    } catch (sessionError) {
      console.error('[subscription] Failed to create checkout session:', sessionError);
      throw sessionError;
    }

    // Update session metadata to include plan type
    await stripe.checkout.sessions.update(session.id, {
      metadata: {
        userId: user._id.toString(),
        plan: plan
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        sessionId: session.id,
        url: session.url
      }
    });
  } catch (error) {
    console.error('Checkout session creation error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create checkout session',
      error: error.message
    });
  }
});

// Handle successful subscription (called after Stripe checkout success)
const handleSubscriptionSuccess = catchAsync(async (req, res, next) => {
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({
        status: 'fail',
        message: 'Session ID is required'
      });
    }

    // Retrieve the checkout session
    const session = await stripeHelpers.stripe.checkout.sessions.retrieve(session_id);
    
    if (!session.subscription) {
      return res.status(400).json({
        status: 'fail',
        message: 'No subscription found in session'
      });
    }

    // Get the subscription details
    const subscription = await stripeHelpers.getSubscription(session.subscription);
    
    // Find user by customer ID
    const user = await User.findOne({ stripe_customer_id: session.customer });
    
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found'
      });
    }

    // Update user's subscription information
    const subscriptionData = mapStripeSubscriptionToInternal(subscription);
    await user.updateSubscription(subscriptionData);

    res.status(200).json({
      status: 'success',
      message: 'Subscription activated successfully',
      data: {
        subscription: user.subscription
      }
    });
  } catch (error) {
    console.error('Subscription success handling error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to process subscription success',
      error: error.message
    });
  }
});

// Get current user's subscription status
const getSubscriptionStatus = catchAsync(async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select('subscription stripe_customer_id stripe_subscription_id');

    if (!user.stripe_subscription_id) {
      return res.status(200).json({
        status: 'success',
        data: {
          subscription: user.subscription,
          hasActiveSubscription: false
        }
      });
    }

    // Get latest subscription data from Stripe
    const stripeSubscription = await stripeHelpers.getSubscription(user.stripe_subscription_id);
    
    // Update local subscription data
    const subscriptionData = mapStripeSubscriptionToInternal(stripeSubscription);
    await user.updateSubscription(subscriptionData);

    res.status(200).json({
      status: 'success',
      data: {
        subscription: user.subscription,
        hasActiveSubscription: user.subscription.status === 'active'
      }
    });
  } catch (error) {
    console.error('Get subscription status error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve subscription status',
      error: error.message
    });
  }
});

// Cancel subscription
const cancelSubscription = catchAsync(async (req, res, next) => {
  try {
    const { immediately = false } = req.body;
    const user = await User.findById(req.user.id);

    if (!user.stripe_subscription_id) {
      return res.status(400).json({
        status: 'fail',
        message: 'No active subscription found'
      });
    }

    // Cancel in Stripe
    const canceledSubscription = await stripeHelpers.cancelSubscription(
      user.stripe_subscription_id,
      immediately
    );

    // Update local subscription data
    const subscriptionData = mapStripeSubscriptionToInternal(canceledSubscription);
    await user.updateSubscription(subscriptionData);

    res.status(200).json({
      status: 'success',
      message: immediately ? 
        'Subscription canceled immediately' : 
        'Subscription will cancel at the end of the current period',
      data: {
        subscription: user.subscription
      }
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to cancel subscription',
      error: error.message
    });
  }
});

// Reactivate subscription (remove cancel_at_period_end)
const reactivateSubscription = catchAsync(async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.stripe_subscription_id) {
      return res.status(400).json({
        status: 'fail',
        message: 'No subscription found'
      });
    }

    // Reactivate in Stripe
    const reactivatedSubscription = await stripeHelpers.reactivateSubscription(
      user.stripe_subscription_id
    );

    // Update local subscription data
    const subscriptionData = mapStripeSubscriptionToInternal(reactivatedSubscription);
    await user.updateSubscription(subscriptionData);

    res.status(200).json({
      status: 'success',
      message: 'Subscription reactivated successfully',
      data: {
        subscription: user.subscription
      }
    });
  } catch (error) {
    console.error('Reactivate subscription error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to reactivate subscription',
      error: error.message
    });
  }
});

// Create billing portal session
const createBillingPortalSession = catchAsync(async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user.stripe_customer_id) {
      return res.status(400).json({
        status: 'fail',
        message: 'No billing information found'
      });
    }

    const session = await stripeHelpers.createBillingPortalSession(
      user.stripe_customer_id,
      `${process.env.SELF_BASE}/account/subscription`
    );

    res.status(200).json({
      status: 'success',
      data: {
        url: session.url
      }
    });
  } catch (error) {
    console.error('Billing portal session error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to create billing portal session',
      error: error.message
    });
  }
});

// Webhook handler for Stripe events
const handleWebhook = catchAsync(async (req, res, next) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  try {
    const event = stripeHelpers.constructEvent(req.body, sig, endpointSecret);

    // Handle the event
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;
        
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
        
      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
        
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      status: 'error',
      message: 'Webhook signature verification failed',
      error: error.message
    });
  }
});

// Helper function to handle subscription updates from webhooks
const handleSubscriptionUpdate = async (subscription) => {
  try {
    const user = await User.findOne({ stripe_customer_id: subscription.customer });
    
    if (user) {
      const subscriptionData = mapStripeSubscriptionToInternal(subscription);
      await user.updateSubscription(subscriptionData);
      console.log(`Updated subscription for user ${user.email}`);
    }
  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
};

// Helper function to handle subscription deletion from webhooks
const handleSubscriptionDeleted = async (subscription) => {
  try {
    const user = await User.findOne({ stripe_customer_id: subscription.customer });
    
    if (user) {
      await user.updateSubscription({
        plan: 'free',
        status: 'cancelled',
        stripe_subscription_id: null,
        current_period_end: new Date(subscription.current_period_end * 1000),
        features: {
          live_scores: true,
          premium_stats: false,
          multiple_teams: false,
          ad_free: false,
          push_notifications: false,
          exclusive_content: false,
          api_access: false
        }
      });
      console.log(`Cancelled subscription for user ${user.email}`);
    }
  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
};

// Helper function to handle successful payments from webhooks
const handlePaymentSucceeded = async (invoice) => {
  try {
    const user = await User.findOne({ stripe_customer_id: invoice.customer });
    
    if (user) {
      // Add billing history entry
      await user.addBillingEntry({
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency.toLowerCase(),
        description: invoice.description || 'Subscription payment',
        status: 'completed',
        stripe_invoice_id: invoice.id,
        completed_at: new Date(invoice.status_transitions.paid_at * 1000)
      });
      console.log(`Recorded payment for user ${user.email}`);
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
};

// Helper function to handle failed payments from webhooks
const handlePaymentFailed = async (invoice) => {
  try {
    const user = await User.findOne({ stripe_customer_id: invoice.customer });
    
    if (user) {
      // Add billing history entry for failed payment
      await user.addBillingEntry({
        amount: invoice.amount_due / 100, // Convert from cents
        currency: invoice.currency.toLowerCase(),
        description: invoice.description || 'Subscription payment (failed)',
        status: 'failed',
        stripe_invoice_id: invoice.id,
        failure_reason: 'Payment failed',
        attempted_at: new Date()
      });
      console.log(`Recorded failed payment for user ${user.email}`);
    }
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
};

module.exports = {
  getPlans,
  createCheckoutSession,
  handleSubscriptionSuccess,
  getSubscriptionStatus,
  cancelSubscription,
  reactivateSubscription,
  createBillingPortalSession,
  handleWebhook
};