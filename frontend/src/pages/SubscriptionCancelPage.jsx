// src/pages/SubscriptionCancelPage.jsx
import React from 'react';
import { Link } from 'react-router-dom';

const SubscriptionCancelPage = () => {
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
        <h1 style={{ color: '#dc3545', marginBottom: '1rem' }}>
          Subscription Cancelled
        </h1>
        
        <p style={{ fontSize: '1.2rem', color: '#666', marginBottom: '2rem' }}>
          Your subscription process was cancelled. No charges have been made to your account.
        </p>
        
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link 
            to="/subscription/plans"
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              padding: '0.75rem 1.5rem',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold'
            }}
          >
            View Plans Again
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

export default SubscriptionCancelPage;