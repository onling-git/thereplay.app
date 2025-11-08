// scripts/setup-stripe-products.js
// Run this script to create the necessary products and prices in Stripe
require('dotenv').config();
const { stripe } = require('../utils/stripe');

async function setupStripeProducts() {
  try {
    console.log('Setting up Stripe products and prices...');

    // Create products first
    console.log('\n1. Creating products...');
    
    const monthlyProduct = await stripe.products.create({
      name: 'Monthly Premium Subscription',
      description: 'Access to premium features including advanced statistics, multiple team following, ad-free experience, and push notifications.',
      metadata: {
        plan: 'monthly',
        features: JSON.stringify([
          'live_scores',
          'premium_stats', 
          'multiple_teams',
          'ad_free',
          'push_notifications',
          'exclusive_content'
        ])
      }
    });

    const yearlyProduct = await stripe.products.create({
      name: 'Yearly Premium Subscription',
      description: 'Access to all premium features including API access. Best value with annual billing.',
      metadata: {
        plan: 'yearly',
        features: JSON.stringify([
          'live_scores',
          'premium_stats',
          'multiple_teams', 
          'ad_free',
          'push_notifications',
          'exclusive_content',
          'api_access'
        ])
      }
    });

    console.log(`✓ Monthly product created: ${monthlyProduct.id}`);
    console.log(`✓ Yearly product created: ${yearlyProduct.id}`);

    // Create prices
    console.log('\n2. Creating prices...');

    const monthlyPrice = await stripe.prices.create({
      product: monthlyProduct.id,
      unit_amount: 999, // £9.99 in pence
      currency: 'gbp',
      recurring: {
        interval: 'month',
        interval_count: 1
      },
      metadata: {
        plan: 'monthly'
      }
    });

    const yearlyPrice = await stripe.prices.create({
      product: yearlyProduct.id,
      unit_amount: 9999, // £99.99 in pence  
      currency: 'gbp',
      recurring: {
        interval: 'year',
        interval_count: 1
      },
      metadata: {
        plan: 'yearly'
      }
    });

    console.log(`✓ Monthly price created: ${monthlyPrice.id} (£${monthlyPrice.unit_amount / 100}/month)`);
    console.log(`✓ Yearly price created: ${yearlyPrice.id} (£${yearlyPrice.unit_amount / 100}/year)`);

    console.log('\n3. Setup complete! 🎉');
    console.log('\nSummary:');
    console.log('========');
    console.log(`Monthly Product ID: ${monthlyProduct.id}`);
    console.log(`Monthly Price ID: ${monthlyPrice.id}`);
    console.log(`Yearly Product ID: ${yearlyProduct.id}`);
    console.log(`Yearly Price ID: ${yearlyPrice.id}`);

    console.log('\n4. Next steps:');
    console.log('- Update your frontend to use these price IDs');
    console.log('- Set up webhooks in your Stripe dashboard');
    console.log('- Test the subscription flow in test mode');
    console.log('- Configure your webhook endpoint: /api/subscription/webhook');

    console.log('\n5. Recommended webhook events to subscribe to:');
    console.log('- customer.subscription.created');
    console.log('- customer.subscription.updated');
    console.log('- customer.subscription.deleted');
    console.log('- invoice.payment_succeeded');
    console.log('- invoice.payment_failed');

    return {
      monthly: {
        productId: monthlyProduct.id,
        priceId: monthlyPrice.id
      },
      yearly: {
        productId: yearlyProduct.id,
        priceId: yearlyPrice.id
      }
    };

  } catch (error) {
    console.error('Error setting up Stripe products:', error);
    
    if (error.code === 'resource_already_exists') {
      console.log('\n⚠️  Some products may already exist. Check your Stripe dashboard.');
    }
    
    throw error;
  }
}

// Run the setup if this file is executed directly
if (require.main === module) {
  setupStripeProducts()
    .then(() => {
      console.log('\n✅ Stripe products setup completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Failed to setup Stripe products:', error.message);
      process.exit(1);
    });
}

module.exports = setupStripeProducts;