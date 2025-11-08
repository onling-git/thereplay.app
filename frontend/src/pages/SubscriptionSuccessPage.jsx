// src/pages/SubscriptionSuccessPage.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useSubscription } from '../contexts/SubscriptionContext';

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
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '400px',
        textAlign: 'center',
        padding: '2rem'
      }}>
        <h1>Processing your subscription...</h1>
        <p>Please wait while we confirm your payment.</p>
      </div>
    );
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '400px',
      textAlign: 'center',
      padding: '2rem'
    }}>
      <div style={{ 
        maxWidth: '600px',
        backgroundColor: '#f8f9fa',
        padding: '3rem',
        borderRadius: '12px',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
      }}>
        <h1 style={{ color: '#28a745', marginBottom: '1rem' }}>
          🎉 Subscription Successful!
        </h1>
        
        <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '2rem' }}>
          Thank you for subscribing! Your premium features are now active.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link 
            to="/account/subscription"
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              padding: '0.75rem 1.5rem',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold'
            }}
          >
            Manage Subscription
          </Link>
          
          <Link 
            to="/"
            style={{
              backgroundColor: '#6c757d',
              color: 'white',
              padding: '0.75rem 1.5rem',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold'
            }}
          >
            Go to Homepage
          </Link>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionSuccessPage;