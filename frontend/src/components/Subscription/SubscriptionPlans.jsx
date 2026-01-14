// src/components/Subscription/SubscriptionPlans.jsx
import React, { useState, useEffect } from 'react';
import { getSubscriptionPlans, createCheckoutSession } from '../../api/subscriptionApi';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { useAuth } from '../../contexts/AuthContext.js';
import './SubscriptionPlans.css';

const SubscriptionPlans = () => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [processingPlan, setProcessingPlan] = useState(null);
  
  const { subscription, hasActiveSubscription, getPlanDisplayName } = useSubscription();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await getSubscriptionPlans();
      setPlans(response.data.plans || []);
    } catch (err) {
      console.error('Failed to fetch subscription plans:', err);
      setError('Failed to load subscription plans. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (plan) => {
    if (!isAuthenticated) {
      const shouldLogin = window.confirm('You need to log in to subscribe to a plan. Would you like to go to the login page?');
      if (shouldLogin) {
        window.location.href = '/login';
      }
      return;
    }

    if (!plan.price_id) {
      alert('This plan is not available for purchase at the moment.');
      return;
    }

    setProcessingPlan(plan.id);

    try {
      // Create checkout session
      const response = await createCheckoutSession(plan.price_id, plan.id);
      
      // Redirect to Stripe checkout URL directly
      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        console.error('No checkout URL received from server');
        alert('Failed to get checkout URL. Please try again.');
      }
    } catch (err) {
      console.error('Checkout session creation failed:', err);
      alert('Failed to start checkout process. Please try again.');
    } finally {
      setProcessingPlan(null);
    }
  };

  const getPlanFeatures = (plan) => {
    const allFeatures = [
      { key: 'ad_free', label: '✨ Ad-Free Experience' },
      { key: 'premium_benefits', label: '🏆 Premium Benefits' },
      { key: 'live_scores', label: '⚡ Live Scores', available: true },
      { key: 'premium_stats', label: '📊 Premium Statistics' },
      { key: 'multiple_teams', label: '⚽ Follow Multiple Teams' },
      { key: 'push_notifications', label: '📱 Push Notifications' },
      { key: 'exclusive_content', label: '🔥 Exclusive Content' },
      { key: 'api_access', label: '🔌 API Access' }
    ];

    return allFeatures.map(feature => ({
      ...feature,
      available: feature.available || plan.features?.[feature.key]
    }));
  };

  const formatPrice = (plan) => {
    // Updated pricing: £0.99/month, £9.99/year
    const prices = {
      monthly: 0.99,
      yearly: 9.99
    };
    
    return prices[plan.id] || 0;
  };

  const isCurrentPlan = (plan) => {
    if (!subscription) return false;
    
    // Map internal plan names to subscription plan IDs
    const planMapping = {
      premium: 'monthly',
      pro: 'yearly'
    };
    
    return planMapping[subscription.plan] === plan.id;
  };

  if (loading) {
    return (
      <div className="subscription-plans">
        <div className="subscription-plans__loading">
          Loading subscription plans...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="subscription-plans">
        <div className="subscription-plans__error">
          {error}
        </div>
        <button onClick={fetchPlans} className="plan-card__button plan-card__button--primary">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="subscription-plans">
      <div className="subscription-plans__header">
        <h1 className="subscription-plans__title">Choose Your Plan</h1>
        <p className="subscription-plans__subtitle">
          Get the most out of your football experience with our premium features
        </p>
      </div>

      {hasActiveSubscription && (
        <div className="subscription-plans__current">
          <h3 className="subscription-plans__current-title">Your Current Plan</h3>
          <div className="subscription-plans__current-plan">
            {getPlanDisplayName()}
          </div>
          <div className="subscription-plans__current-status">
            {subscription?.cancel_at_period_end 
              ? `Cancels on ${new Date(subscription.current_period_end).toLocaleDateString()}`
              : `Renews on ${new Date(subscription.current_period_end).toLocaleDateString()}`
            }
          </div>
        </div>
      )}

      <div className="subscription-plans__grid">
        {plans.map((plan, index) => {
          const features = getPlanFeatures(plan);
          const price = formatPrice(plan);
          const isYearly = plan.interval === 'year';
          const isCurrent = isCurrentPlan(plan);
          const isProcessing = processingPlan === plan.id;

          return (
            <div 
              key={plan.id}
              className={`plan-card ${isYearly ? 'plan-card--featured' : ''}`}
            >
              <div className="plan-card__header">
                <h3 className="plan-card__name">{plan.name}</h3>
                <div className="plan-card__price">
                  £{price}
                  <span className="plan-card__currency">GBP</span>
                </div>
                <div className="plan-card__interval">
                  per {plan.interval}
                </div>
                {isYearly && (
                  <div className="plan-card__savings">
                    2 months free!
                  </div>
                )}
              </div>

              <ul className="plan-card__features">
                {features.map((feature) => (
                  <li 
                    key={feature.key}
                    className={`plan-card__feature ${
                      !feature.available ? 'plan-card__feature--unavailable' : ''
                    }`}
                  >
                    {feature.label}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan)}
                disabled={isCurrent || isProcessing || !isAuthenticated}
                className={`plan-card__button ${
                  isYearly ? 'plan-card__button--primary' : 'plan-card__button--secondary'
                }`}
              >
                {isProcessing ? 'Processing...' :
                 isCurrent ? 'Current Plan' :
                 !isAuthenticated ? 'Log in to Subscribe' :
                 `Subscribe to ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {plans.length === 0 && !loading && (
        <div className="subscription-plans__error">
          No subscription plans are currently available. Please check back later.
        </div>
      )}
    </div>
  );
};

export default SubscriptionPlans;