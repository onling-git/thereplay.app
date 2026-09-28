// src/pages/SubscriptionCancelPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import '../components/Subscription/SubscriptionPlans.css';

const SubscriptionCancelPage = () => {
  return (
    <div className="subscription-result">
      <div className="subscription-result__content card">
        <h1 style={{ color: '#dc3545', marginBottom: '1rem' }}>
          Subscription Cancelled
        </h1>
        
        <p className="subscription-result__message">
          Your subscription process was cancelled. No charges have been made to your account.
        </p>
        
        <div className="subscription-result__actions">
          <Link 
            to="/subscription/plans"
            className="btn-secondary"
          >
            View Plans Again
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

export default SubscriptionCancelPage;