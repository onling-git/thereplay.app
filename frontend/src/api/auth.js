// src/api/auth.js
const API_BASE = process.env.REACT_APP_API_BASE || 'https://virtuous-exploration-production.up.railway.app';

async function authReq(path, opts = {}) {
  const url = API_BASE + path;
  console.log('🌐 authReq called:', { path, url });
  
  // Get token from localStorage as fallback
  const token = localStorage.getItem('authToken');
  console.log('🔐 Auth token exists:', !!token);
  console.log('🔐 Token preview:', token ? `${token.substring(0, 20)}...` : 'none');
  
  const defaultOpts = {
    credentials: 'include', // Include cookies for JWT
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }), // Add token to header if available
      ...opts.headers
    }
  };
  
  const finalOpts = { ...defaultOpts, ...opts };
  console.log('📤 Request options:', finalOpts);

  const res = await fetch(url, finalOpts);
  console.log('📡 Response status:', res.status, res.statusText);
  console.log('📡 Response ok:', res.ok);
  
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error('❌ Error response text:', text);
    let body;
    try { 
      body = JSON.parse(text); 
    } catch { 
      body = { message: text || res.statusText }; 
    }
    const err = new Error('API error');
    err.status = res.status;
    err.body = body;
    console.error('❌ Throwing error:', err);
    throw err;
  }
  
  const jsonResult = await res.json().catch(() => null);
  console.log('✅ authReq success result:', jsonResult);
  return jsonResult;
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
  console.log('🔄 updateTeamPreferences called with:', teamData);
  try {
    const result = await authReq('/api/users/team-preferences', {
      method: 'PATCH',
      body: JSON.stringify(teamData)
    });
    console.log('✅ updateTeamPreferences success:', result);
    return result;
  } catch (error) {
    console.error('❌ updateTeamPreferences error:', error);
    throw error;
  }
}

export async function getTeamPreferences() {
  return authReq('/api/users/team-preferences');
}

export async function setAnonymousTeamPreferences(teamData) {
  console.log('🔄 setAnonymousTeamPreferences called with:', teamData);
  try {
    const result = await fetch(`${API_BASE}/api/users/team-preferences/anonymous`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(teamData)
    });
    
    console.log('📡 Anonymous request status:', result.status);
    console.log('📡 Anonymous request ok:', result.ok);
    
    if (!result.ok) {
      const errorText = await result.text();
      console.error('❌ Anonymous response error text:', errorText);
      throw new Error(`Failed to save anonymous preferences: ${result.status} ${errorText}`);
    }
    
    const data = await result.json();
    console.log('✅ setAnonymousTeamPreferences success:', data);
    return data;
  } catch (error) {
    console.error('❌ setAnonymousTeamPreferences error:', error);
    throw error;
  }
}