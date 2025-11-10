const Stripe = require('stripe');

// Initialize Stripe with the secret key from environment variables
let stripe = null;

console.log('[stripe] Starting Stripe initialization...');
console.log('[stripe] STRIPE_SECRET_KEY present:', !!process.env.STRIPE_SECRET_KEY);

try {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('[stripe] Warning: STRIPE_SECRET_KEY not found in environment variables. Stripe functionality will be limited.');
    console.warn('[stripe] Available env vars:', Object.keys(process.env).filter(key => key.includes('STRIPE')));
  } else {
    console.log('[stripe] Initializing Stripe SDK...');
    console.log('[stripe] Initializing Stripe SDK with provided key...');
    stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    console.log('[stripe] Stripe SDK initialized successfully');
  }
} catch (error) {
  console.error('[stripe] Failed to initialize Stripe SDK:', error.message);
  console.error('[stripe] Error details:', {
    name: error.name,
    message: error.message,
    stack: error.stack
  });
  stripe = null;
}

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
  monthly: {
    name: 'Monthly',
    interval: 'month',
    interval_count: 1,
    currency: 'gbp',
    features: {
      live_scores: true,
      premium_stats: true,
      multiple_teams: true,
      ad_free: true,
      push_notifications: true,
      exclusive_content: true,
      api_access: false
    }
  },
  yearly: {
    name: 'Yearly',
    interval: 'year',
    interval_count: 1,
    currency: 'gbp',
    features: {
      live_scores: true,
      premium_stats: true,
      multiple_teams: true,
      ad_free: true,
      push_notifications: true,
      exclusive_content: true,
      api_access: true
    }
  }
};

// Helper functions for Stripe operations
const stripeHelpers = {
  /**
   * Check if Stripe is properly initialized
   * @returns {boolean} Whether Stripe is available
   */
  isStripeAvailable() {
    return stripe !== null && process.env.STRIPE_SECRET_KEY;
  },

  /**
   * Create a Stripe customer
   * @param {Object} userData - User data containing email, name, etc.
   * @returns {Promise<Object>} Stripe customer object
   */
  async createCustomer(userData) {
    if (!this.isStripeAvailable()) {
      throw new Error('Stripe is not properly configured');
    }
    
    try {
      const customer = await stripe.customers.create({
        email: userData.email,
        name: `${userData.first_name} ${userData.surname}`,
        metadata: {
          userId: userData.id.toString(),
          registeredAt: new Date().toISOString()
        }
      });
      return customer;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  },

  /**
   * Create a checkout session for subscription
   * @param {string} customerId - Stripe customer ID
   * @param {string} priceId - Stripe price ID
   * @param {string} successUrl - Success redirect URL
   * @param {string} cancelUrl - Cancel redirect URL
   * @returns {Promise<Object>} Stripe checkout session
   */
  async createCheckoutSession(customerId, priceId, successUrl, cancelUrl) {
    try {
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: successUrl,
        cancel_url: cancelUrl,
        allow_promotion_codes: true,
        billing_address_collection: 'required',
        customer_update: {
          address: 'auto',
          name: 'auto'
        }
      });
      return session;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  },

  /**
   * Create a billing portal session
   * @param {string} customerId - Stripe customer ID
   * @param {string} returnUrl - Return URL after managing billing
   * @returns {Promise<Object>} Stripe billing portal session
   */
  async createBillingPortalSession(customerId, returnUrl) {
    try {
      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });
      return session;
    } catch (error) {
      console.error('Error creating billing portal session:', error);
      throw error;
    }
  },

  /**
   * Get subscription by ID
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Stripe subscription object
   */
  async getSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Error retrieving subscription:', error);
      throw error;
    }
  },

  /**
   * Cancel a subscription
   * @param {string} subscriptionId - Stripe subscription ID
   * @param {boolean} immediately - Whether to cancel immediately or at period end
   * @returns {Promise<Object>} Updated subscription object
   */
  async cancelSubscription(subscriptionId, immediately = false) {
    try {
      if (immediately) {
        const subscription = await stripe.subscriptions.cancel(subscriptionId);
        return subscription;
      } else {
        const subscription = await stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true,
        });
        return subscription;
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      throw error;
    }
  },

  /**
   * Reactivate a subscription that was set to cancel at period end
   * @param {string} subscriptionId - Stripe subscription ID
   * @returns {Promise<Object>} Updated subscription object
   */
  async reactivateSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {
        cancel_at_period_end: false,
      });
      return subscription;
    } catch (error) {
      console.error('Error reactivating subscription:', error);
      throw error;
    }
  },

  /**
   * Get price IDs for subscription plans
   * @returns {Object} Object containing price IDs for monthly and yearly plans
   */
  getPriceIds() {
    return {
      monthly: 'price_1SRF2XCIJObwi2H9etPv35OF', // £0.99/month
      yearly: 'price_1SRF2XCIJObwi2H9t44Rxfzw'   // £9.99/year
    };
  },

  /**
   * Construct event from webhook
   * @param {string} payload - Raw request body
   * @param {string} signature - Stripe signature header
   * @param {string} endpointSecret - Webhook endpoint secret
   * @returns {Object} Stripe event object
   */
  constructEvent(payload, signature, endpointSecret) {
    try {
      const event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
      return event;
    } catch (error) {
      console.error('Error constructing webhook event:', error);
      throw error;
    }
  }
};

module.exports = {
  stripe,
  stripeHelpers,
  SUBSCRIPTION_PLANS
};