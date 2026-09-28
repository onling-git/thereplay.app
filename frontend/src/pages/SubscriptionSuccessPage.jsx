// src/pages/SubscriptionSuccessPage.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSubscription } from '../contexts/SubscriptionContext';
import '../components/Subscription/SubscriptionPlans.css';

const SubscriptionSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const { fetchSubscriptionStatus } = useSubscription();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (sessionId) {
      // Refresh subscription status after successful payment
      fetchSubscriptionStatus().finally(() => {
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [searchParams, fetchSubscriptionStatus]);

  if (loading) {
    return (
      <div className="subscription-result">
        <h1>Processing your subscription...</h1>
        <p>Please wait while we confirm your payment.</p>
      </div>
    );
  }

  return (
    <div className="subscription-result">
      <div className="subscription-result__content card">
        <h1 style={{ color: '#28a745', marginBottom: '1rem' }}>
          🎉 Subscription Successful!
        </h1>
        
        <p className="subscription-result__message">
          Thank you for subscribing! Your premium features are now active.
        </p>
        
        <div className="subscription-result__actions">
          <Link 
            to="/account/subscription"
            className="btn-secondary"
          >
            Manage Subscription
          </Link>
          
          <Link 
            to="/"
            className="btn"
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccessPage;