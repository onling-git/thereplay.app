// components/Admin/AdminPanel.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AdminAuth from './AdminAuth';
import TeamManagement from './TeamManagement';
import RssManagement from './RssManagement';
import TeamFeedSubscriptions from './TeamFeedSubscriptions';
import UnifiedRssManagement from './UnifiedRssManagement';
import LeagueManagement from './LeagueManagement';
import './AdminPanel.css';

const AdminPanel = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const [adminUser, setAdminUser] = useState(null);
  const [activeTab, setActiveTab] = useState('rss-unified'); // Default to new unified interface
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated and has admin privileges
    if (isAuthenticated && user && ['admin', 'super_admin'].includes(user.role)) {
      const adminAuthenticated = sessionStorage.getItem('admin_authenticated');
      if (adminAuthenticated) {
        setAdminUser(user);
      }
    }
    setLoading(false);
  }, [isAuthenticated, user]);

  const handleAuthenticated = (userData) => {
    setAdminUser(userData);
  };

  const handleLogout = async () => {
    sessionStorage.removeItem('admin_authenticated');
    setAdminUser(null);
    setActiveTab('rss-unified');
    await logout(); // Log out from the main application too
  };

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="loading">Loading admin panel...</div>
      </div>
    );
  }

  if (!adminUser) {
    return <AdminAuth onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <div className="admin-nav">
          <h1>Admin Panel</h1>
          <div className="user-info">
            <span>Welcome, {adminUser.first_name} {adminUser.surname}</span>
            <span className="role-badge">{adminUser.role}</span>
          </div>
          <div className="nav-tabs">
            <button
              className={`nav-tab ${activeTab === 'teams' ? 'active' : ''}`}
              onClick={() => setActiveTab('teams')}
            >
              Team Management
            </button>
            <button
              className={`nav-tab ${activeTab === 'leagues' ? 'active' : ''}`}
              onClick={() => setActiveTab('leagues')}
            >
              League Management
            </button>
            <button
              className={`nav-tab ${activeTab === 'rss-unified' ? 'active' : ''}`}
              onClick={() => setActiveTab('rss-unified')}
            >
              RSS Feed & Team Management
            </button>
            <button
              className={`nav-tab ${activeTab === 'rss-legacy' ? 'active' : ''}`}
              onClick={() => setActiveTab('rss-legacy')}
            >
              Legacy RSS (Separate Tabs)
            </button>
          </div>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'teams' && (
          <TeamManagement user={adminUser} />
        )}
        {activeTab === 'leagues' && (
          <LeagueManagement user={adminUser} />
        )}
        {activeTab === 'rss-unified' && (
          <UnifiedRssManagement user={adminUser} />
        )}
        {activeTab === 'rss-legacy' && (
          <div className="legacy-tabs">
            <div className="legacy-nav">
              <button className="legacy-tab active">RSS Feeds</button>
              <button className="legacy-tab">Team Feed Subscriptions</button>
            </div>
            <RssManagement user={adminUser} />
            <hr style={{ margin: '40px 0', opacity: 0.3 }} />
            <TeamFeedSubscriptions user={adminUser} />
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;