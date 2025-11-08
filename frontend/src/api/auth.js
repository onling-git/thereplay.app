// src/api/auth.js
const API_BASE = process.env.REACT_APP_API_BASE || 'https://virtuous-exploration-production.up.railway.app';

async function authReq(path, opts = {}) {
  const url = API_BASE + path;
  
  // Get token from localStorage as fallback
  const token = localStorage.getItem('authToken');
  
  const defaultOpts = {
    credentials: 'include', // Include cookies for JWT
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }), // Add token to header if available
      ...opts.headers
    }
  };
  
  const finalOpts = { ...defaultOpts, ...opts };
  
  const res = await fetch(url, finalOpts);
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    let body;
    try { 
      body = JSON.parse(text); 
    } catch { 
      body = { message: text || res.statusText }; 
    }
    const err = new Error('API error');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  
  return res.json().catch(() => null);
}

export async function register(userData) {
  return authReq('/api/users/register', {
    method: 'POST',
    body: JSON.stringify(userData)
  });
}

export async function login(email, password) {
  return authReq('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
}

export async function logout() {
  return authReq('/api/users/logout', {
    method: 'POST'
  });
}

export async function getCurrentUser() {
  return authReq('/api/users/me');
}

export async function updateProfile(profileData) {
  return authReq('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(profileData)
  });
}

export async function changePassword(passwordData) {
  return authReq('/api/users/change-password', {
    method: 'PATCH',
    body: JSON.stringify(passwordData)
  });
}

export async function forgotPassword(email) {
  return authReq('/api/users/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  });
}

export async function resetPassword(token, password, confirmPassword) {
  return authReq('/api/users/reset-password', {
    method: 'PATCH',
    body: JSON.stringify({ token, password, confirmPassword })
  });
}

export async function updateTeamPreferences(teamData) {
  return authReq('/api/users/team-preferences', {
    method: 'PATCH',
    body: JSON.stringify(teamData)
  });
}

export async function getTeamPreferences() {
  return authReq('/api/users/team-preferences');
}

export async function setAnonymousTeamPreferences(teamData) {
  return authReq('/api/users/team-preferences/anonymous', {
    method: 'POST',
    body: JSON.stringify(teamData)
  });
}