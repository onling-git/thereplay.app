// src/api/subscriptionApi.js
const API_BASE = process.env.REACT_APP_API_BASE || 'https://virtuous-exploration-production.up.railway.app';

async function authReq(path, opts = {}) {
  const token = localStorage.getItem('authToken');
  const url = API_BASE + path;
  
  const defaultOpts = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    },
    credentials: 'include'
  };
  
  const finalOpts = {
    ...defaultOpts,
    ...opts,
    headers: {
      ...defaultOpts.headers,
      ...opts.headers
    }
  };

  const res = await fetch(url, finalOpts);
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let body;
    try { 
      body = JSON.parse(text); 
    } catch { 
      body = text || res.statusText; 
    }
    const err = new Error('API error');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  
  return res.json().catch(() => null);
}

// Get available subscription plans
export async function getSubscriptionPlans() {
  return authReq('/api/subscription/plans');
}

// Create a checkout session
export async function createCheckoutSession(priceId, plan) {
  return authReq('/api/subscription/checkout', {
    method: 'POST',
    body: JSON.stringify({ priceId, plan })
  });
}

// Get current subscription status
export async function getSubscriptionStatus() {
  return authReq('/api/subscription/status');
}

// Cancel subscription
export async function cancelSubscription(immediately = false) {
  return authReq('/api/subscription/cancel', {
    method: 'POST',
    body: JSON.stringify({ immediately })
  });
}

// Reactivate subscription
export async function reactivateSubscription() {
  return authReq('/api/subscription/reactivate', {
    method: 'POST'
  });
}

// Create billing portal session
export async function createBillingPortalSession() {
  return authReq('/api/subscription/billing-portal', {
    method: 'POST'
  });
}