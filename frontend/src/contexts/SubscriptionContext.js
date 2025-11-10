// src/contexts/SubscriptionContext.js
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { getSubscriptionStatus } from '../api/subscriptionApi';
import { useAuth } from './AuthContext';

const SubscriptionContext = createContext();

// Subscription state reducer
const subscriptionReducer = (state, action) => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_SUBSCRIPTION':
      return { 
        ...state, 
        subscription: action.payload.subscription,
        hasActiveSubscription: action.payload.hasActiveSubscription,
        loading: false 
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    case 'CLEAR_ERROR':
      return { ...state, error: null };
    case 'RESET':
      return {
        subscription: null,
        hasActiveSubscription: false,
        loading: false,
        error: null
      };
    default:
      return state;
  }
};

const initialState = {
  subscription: null,
  hasActiveSubscription: false,
  loading: false,
  error: null
};

export const SubscriptionProvider = ({ children }) => {
  const [state, dispatch] = useReducer(subscriptionReducer, initialState);
  const { isAuthenticated } = useAuth();

  // Fetch subscription status
  const fetchSubscriptionStatus = async () => {
    // Only fetch if user is definitely authenticated
    if (!isAuthenticated || isAuthenticated !== true) {
      dispatch({ type: 'RESET' });
      return;
    }

    // Double-check token exists
    const token = localStorage.getItem('token');
    if (!token) {
      dispatch({ type: 'RESET' });
      return;
    }

    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      const response = await getSubscriptionStatus();
      dispatch({ 
        type: 'SET_SUBSCRIPTION', 
        payload: {
          subscription: response.data.subscription,
          hasActiveSubscription: response.data.hasActiveSubscription
        }
      });
    } catch (error) {
      console.error('Failed to fetch subscription status:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error.body?.message || 'Failed to fetch subscription status' 
      });
    }
  };

  // Clear error
  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  // Check if user has access to a specific feature
  const hasFeatureAccess = (feature) => {
    if (!state.subscription) return false;
    return state.subscription.features?.[feature] || false;
  };

  // Get subscription plan display name
  const getPlanDisplayName = () => {
    if (!state.subscription) return 'Free';
    
    const planNames = {
      free: 'Free',
      basic: 'Basic',
      premium: 'Premium',
      pro: 'Pro',
      enterprise: 'Enterprise'
    };
    
    return planNames[state.subscription.plan] || state.subscription.plan;
  };

  // Check if subscription is ending soon (within 7 days)
  const isSubscriptionEndingSoon = () => {
    if (!state.subscription || !state.subscription.current_period_end) return false;
    
    const endDate = new Date(state.subscription.current_period_end);
    const now = new Date();
    const daysUntilEnd = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    return daysUntilEnd <= 7 && daysUntilEnd > 0;
  };

  // Get days until subscription ends
  const getDaysUntilRenewal = () => {
    if (!state.subscription || !state.subscription.current_period_end) return null;
    
    const endDate = new Date(state.subscription.current_period_end);
    const now = new Date();
    const daysUntilEnd = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    
    return daysUntilEnd;
  };

  // Effect to fetch subscription status when user logs in
  useEffect(() => {
    // Only run effect when authentication state is definitely resolved
    if (isAuthenticated === true) {
      fetchSubscriptionStatus();
    } else if (isAuthenticated === false) {
      dispatch({ type: 'RESET' });
    }
  }, [isAuthenticated]);

  const value = {
    ...state,
    fetchSubscriptionStatus,
    clearError,
    hasFeatureAccess,
    getPlanDisplayName,
    isSubscriptionEndingSoon,
    getDaysUntilRenewal
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};