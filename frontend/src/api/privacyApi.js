// Frontend API for privacy/cookie consent
// src/api/privacyApi.js
const API_BASE = process.env.REACT_APP_API_BASE || 'https://virtuous-exploration-production.up.railway.app';

async function authReq(path, opts = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...opts.headers
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  
  return fetch(`${API_BASE}${path}`, {
    ...opts,
    credentials: 'include', // Include cookies
    headers
  });
}

// Get current privacy status (public endpoint)
export async function getPrivacyStatus() {
  try {
    const response = await fetch(`${API_BASE}/api/privacy/privacy-status`, {
      method: 'GET',
      credentials: 'include', // Include cookies for consent checking
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching privacy status:', error);
    throw error;
  }
}

// Get user's privacy settings (requires authentication)
export async function getPrivacySettings() {
  try {
    const response = await authReq('/api/privacy/privacy-settings');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching privacy settings:', error);
    throw error;
  }
}

// Update user's privacy settings (requires authentication)
export async function updatePrivacySettings(settings) {
  try {
    const response = await authReq('/api/privacy/privacy-settings', {
      method: 'PATCH',
      body: JSON.stringify(settings)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error updating privacy settings:', error);
    throw error;
  }
}

// Update cookie consent specifically
export async function updateCookieConsent(consent) {
  return updatePrivacySettings({
    cookie_consent: {
      necessary: consent.necessary || true,
      analytics: consent.analytics || false,
      marketing: consent.marketing || false,
      personalization: consent.personalization || false,
      method: consent.method || 'customize',
      updated_at: new Date().toISOString()
    }
  });
}

// Delete privacy data (GDPR compliance)
export async function deletePrivacyData() {
  try {
    const response = await authReq('/api/privacy/delete-privacy-data', {
      method: 'DELETE',
      body: JSON.stringify({ confirm: 'DELETE' })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Error deleting privacy data:', error);
    throw error;
  }
}

// Export privacy data (GDPR compliance)
export async function exportPrivacyData() {
  try {
    const response = await authReq('/api/privacy/export-privacy-data');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // For file download, we need to handle the blob
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'privacy-data-export.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return { status: 'success', message: 'Privacy data exported successfully' };
  } catch (error) {
    console.error('Error exporting privacy data:', error);
    throw error;
  }
}

export default {
  getPrivacyStatus,
  getPrivacySettings,
  updatePrivacySettings,
  updateCookieConsent,
  deletePrivacyData,
  exportPrivacyData
};