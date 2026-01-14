// components/Admin/AdminAuth.jsx
import React, { useState } from 'react';
import './AdminAuth.css';

const AdminAuth = ({ onAuthenticated }) => {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Test API key with a simple request
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/admin/teams/teams`, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Store API key in session storage
        sessionStorage.setItem('admin_api_key', apiKey);
        onAuthenticated(apiKey);
      } else {
        setError('Invalid API key');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError('Authentication failed. Please check your API key.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth">
      <div className="admin-auth-modal">
        <h2>Admin Access Required</h2>
        <p>Please enter your admin API key to access the admin panel.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="apiKey">API Key:</label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter admin API key"
              required
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading || !apiKey.trim()}
            className="auth-button"
          >
            {loading ? 'Authenticating...' : 'Access Admin Panel'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminAuth;