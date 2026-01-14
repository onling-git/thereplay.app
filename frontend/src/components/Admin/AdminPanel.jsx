// components/Admin/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
import AdminAuth from './AdminAuth';
import TeamManagement from './TeamManagement';
import RssManagement from './RssManagement';
import './AdminPanel.css';

const AdminPanel = () => {
  const [apiKey, setApiKey] = useState(null);
  const [activeTab, setActiveTab] = useState('teams');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated
    const storedApiKey = sessionStorage.getItem('admin_api_key');
    if (storedApiKey) {
      setApiKey(storedApiKey);
    }
    setLoading(false);
  }, []);

  const handleAuthenticated = (key) => {
    setApiKey(key);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('admin_api_key');
    setApiKey(null);
    setActiveTab('teams');
  };

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="loading">Loading admin panel...</div>
      </div>
    );
  }

  if (!apiKey) {
    return <AdminAuth onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-nav">
          <h1>Admin Panel</h1>
          <div className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === 'teams' ? 'active' : ''}`}
              onClick={() => setActiveTab('teams')}
            >
              Team Management
            </button>
            <button
              className={`nav-tab ${activeTab === 'rss' ? 'active' : ''}`}
              onClick={() => setActiveTab('rss')}
            >
              RSS Feeds
            </button>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'teams' && (
          <TeamManagement apiKey={apiKey} />
        )}
        {activeTab === 'rss' && (
          <RssManagement apiKey={apiKey} />
        )}
      </div>
    </div>
  );
};

export default AdminPanel;