// components/Admin/RssManagement.jsx
import React, { useState, useEffect } from 'react';
import './RssManagement.css';

const RssManagement = ({ apiKey }) => {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingFeed, setEditingFeed] = useState(null);
  const [stats, setStats] = useState(null);
  
  const [newFeed, setNewFeed] = useState({
    // id field is auto-generated, no need to set it
    name: '',
    url: '',
    enabled: true,
    priority: 1,
    keywords: [],
    description: '',
    fetchTimeout: 10000,
    scope: 'generic',
    teams: [],
    leagues: [],
    countries: []
  });

  useEffect(() => {
    fetchFeeds();
    fetchStats();
  }, []);

  const fetchFeeds = async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filterEnabled !== 'all') {
        queryParams.append('enabled', filterEnabled);
      }
      if (searchTerm) {
        queryParams.append('search', searchTerm);
      }

      const response = await fetch(
        `${process.env.REACT_APP_API_BASE}/api/admin/rss/feeds?${queryParams}`,
        {
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setFeeds(data.feeds || []);
        setError('');
      } else {
        throw new Error('Failed to fetch RSS feeds');
      }
    } catch (error) {
      console.error('Error fetching feeds:', error);
      setError('Failed to load RSS feeds');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/admin/rss/stats`, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const createFeed = async (feedData) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/admin/rss/feeds`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(feedData)
      });

      if (response.ok) {
        await fetchFeeds();
        await fetchStats();
        setShowAddForm(false);
        setNewFeed({
          name: '',
          url: '',
          enabled: true,
          priority: 1,
          keywords: [],
          description: '',
          fetchTimeout: 10000,
          scope: 'generic',
          teams: [],
          leagues: [],
          countries: []
        });
        return true;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create RSS feed');
      }
    } catch (error) {
      console.error('Error creating feed:', error);
      setError(error.message || 'Failed to create RSS feed');
      return false;
    }
  };

  const updateFeed = async (feedId, feedData) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/admin/rss/feeds/${feedId}`, {
        method: 'PUT',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(feedData)
      });

      if (response.ok) {
        await fetchFeeds();
        await fetchStats();
        setEditingFeed(null);
        return true;
      } else {
        throw new Error('Failed to update RSS feed');
      }
    } catch (error) {
      console.error('Error updating feed:', error);
      setError('Failed to update RSS feed');
      return false;
    }
  };

  const deleteFeed = async (feedId, feedName) => {
    if (!window.confirm(`Are you sure you want to delete "${feedName}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/admin/rss/feeds/${feedId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchFeeds();
        await fetchStats();
      } else {
        throw new Error('Failed to delete RSS feed');
      }
    } catch (error) {
      console.error('Error deleting feed:', error);
      setError('Failed to delete RSS feed');
    }
  };

  const toggleFeed = async (feedId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/admin/rss/feeds/${feedId}/toggle`, {
        method: 'PATCH',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchFeeds();
        await fetchStats();
      } else {
        throw new Error('Failed to toggle RSS feed');
      }
    } catch (error) {
      console.error('Error toggling feed:', error);
      setError('Failed to toggle RSS feed');
    }
  };

  const testFeed = async (feedId, feedName) => {
    try {
      setError('');
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/admin/rss/feeds/${feedId}/test`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.testResult.success) {
          alert(`✅ Test successful for "${feedName}"!\nFetched ${data.testResult.articleCount} articles.`);
        } else {
          alert(`❌ Test failed for "${feedName}":\n${data.testResult.error}`);
        }
        await fetchFeeds();
      } else {
        throw new Error('Failed to test RSS feed');
      }
    } catch (error) {
      console.error('Error testing feed:', error);
      setError('Failed to test RSS feed');
    }
  };

  useEffect(() => {
    const delayedSearch = setTimeout(() => {
      fetchFeeds();
    }, 300);

    return () => clearTimeout(delayedSearch);
  }, [searchTerm, filterEnabled]);

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return '#28a745';
      case 'error': return '#dc3545';
      case 'disabled': return '#6c757d';
      case 'never-fetched': return '#ffc107';
      default: return '#6c757d';
    }
  };

  if (loading) {
    return (
      <div className="rss-management">
        <div className="loading">Loading RSS feeds...</div>
      </div>
    );
  }

  return (
    <div className="rss-management">
      <div className="rss-management-header">
        <h2>RSS Feed Management</h2>
        <button
          onClick={() => setShowAddForm(true)}
          className="add-feed-button"
        >
          + Add RSS Feed
        </button>
      </div>

      {stats && (
        <div className="rss-stats">
          <div className="stat-card">
            <h3>Total Feeds</h3>
            <div className="stat-value">{stats.total}</div>
          </div>
          <div className="stat-card">
            <h3>Enabled</h3>
            <div className="stat-value enabled">{stats.enabled}</div>
          </div>
          <div className="stat-card">
            <h3>Disabled</h3>
            <div className="stat-value disabled">{stats.disabled}</div>
          </div>
          <div className="stat-card">
            <h3>With Errors</h3>
            <div className="stat-value error">{stats.withErrors}</div>
          </div>
          <div className="stat-card">
            <h3>Total Articles</h3>
            <div className="stat-value">{stats.articles.totalArticles}</div>
          </div>
        </div>
      )}

      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search feeds..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <select
          value={filterEnabled}
          onChange={(e) => setFilterEnabled(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Feeds</option>
          <option value="true">Enabled Only</option>
          <option value="false">Disabled Only</option>
        </select>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {showAddForm && (
        <div className="modal-overlay">
          <div className="add-feed-modal">
            <h3>Add New RSS Feed</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              createFeed(newFeed);
            }}>
              <div className="form-row">
                <label>Name: <span className="required">*</span></label>
                <input
                  type="text"
                  value={newFeed.name}
                  onChange={(e) => setNewFeed({...newFeed, name: e.target.value})}
                  placeholder="Feed Name"
                  required
                />
              </div>
              <div className="form-row">
                <label>URL: <span className="required">*</span></label>
                <input
                  type="url"
                  value={newFeed.url}
                  onChange={(e) => setNewFeed({...newFeed, url: e.target.value})}
                  placeholder="https://example.com/rss"
                  required
                />
              </div>
              <div className="form-row">
                <label>Priority (1-100):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newFeed.priority}
                  onChange={(e) => setNewFeed({...newFeed, priority: parseInt(e.target.value)})}
                />
              </div>
              <div className="form-row">
                <label>Keywords (comma-separated):</label>
                <input
                  type="text"
                  value={newFeed.keywords.join(', ')}
                  onChange={(e) => setNewFeed({...newFeed, keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)})}
                  placeholder="football, soccer, premier league"
                />
                <small>Keywords help identify relevant articles from this feed</small>
              </div>
              <div className="form-row">
                <label>Scope:</label>
                <select
                  value={newFeed.scope}
                  onChange={(e) => setNewFeed({...newFeed, scope: e.target.value})}
                >
                  <option value="generic">Generic (All relevant articles)</option>
                  <option value="team">Team-specific</option>
                  <option value="league">League-specific</option>
                  <option value="country">Country-specific</option>
                </select>
              </div>
              {newFeed.scope === 'team' && (
                <div className="form-row">
                  <label>Teams (comma-separated team IDs/slugs):</label>
                  <input
                    type="text"
                    value={newFeed.teams.join(', ')}
                    onChange={(e) => setNewFeed({...newFeed, teams: e.target.value.split(',').map(t => t.trim()).filter(t => t)})}
                    placeholder="southampton, manchester-city"
                  />
                </div>
              )}
              {newFeed.scope === 'league' && (
                <div className="form-row">
                  <label>Leagues (comma-separated league IDs):</label>
                  <input
                    type="text"
                    value={newFeed.leagues.join(', ')}
                    onChange={(e) => setNewFeed({...newFeed, leagues: e.target.value.split(',').map(l => l.trim()).filter(l => l)})}
                    placeholder="8, 9, 24"
                  />
                </div>
              )}
              {newFeed.scope === 'country' && (
                <div className="form-row">
                  <label>Countries (comma-separated country codes):</label>
                  <input
                    type="text"
                    value={newFeed.countries.join(', ')}
                    onChange={(e) => setNewFeed({...newFeed, countries: e.target.value.split(',').map(c => c.trim()).filter(c => c)})}
                    placeholder="gb, es, it"
                  />
                </div>
              )}
              <div className="form-row">
                <label>Description:</label>
                <textarea
                  value={newFeed.description}
                  onChange={(e) => setNewFeed({...newFeed, description: e.target.value})}
                  placeholder="Feed description..."
                  rows="3"
                />
              </div>
              <div className="form-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newFeed.enabled}
                    onChange={(e) => setNewFeed({...newFeed, enabled: e.target.checked})}
                  />
                  <span>Enabled</span>
                </label>
              </div>
              <div className="modal-actions">
                <button type="submit" className="save-button">Create Feed</button>
                <button type="button" onClick={() => setShowAddForm(false)} className="cancel-button">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="feeds-table-container">
        <table className="feeds-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Name</th>
              <th>URL</th>
              <th>Priority</th>
              <th>Articles</th>
              <th>Last Fetched</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {feeds.map(feed => (
              <tr key={feed.id}>
                <td>
                  <span 
                    className="status-indicator"
                    style={{ backgroundColor: getStatusColor(feed.status) }}
                    title={feed.status}
                  />
                  {feed.enabled ? 'Enabled' : 'Disabled'}
                </td>
                <td>
                  <div className="feed-name">
                    <strong>{feed.name}</strong>
                    <small>{feed.feedId}</small>
                  </div>
                </td>
                <td>
                  <a href={feed.url} target="_blank" rel="noopener noreferrer" className="feed-url">
                    {feed.url.length > 50 ? `${feed.url.substring(0, 50)}...` : feed.url}
                  </a>
                </td>
                <td>{feed.priority}</td>
                <td>{feed.articleCount || 0}</td>
                <td>{formatDate(feed.lastFetched)}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      onClick={() => toggleFeed(feed.id)}
                      className={`toggle-button ${feed.enabled ? 'disable' : 'enable'}`}
                      title={feed.enabled ? 'Disable feed' : 'Enable feed'}
                    >
                      {feed.enabled ? '⏸' : '▶'}
                    </button>
                    <button
                      onClick={() => testFeed(feed.id, feed.name)}
                      className="test-button"
                      title="Test feed"
                    >
                      🧪
                    </button>
                    <button
                      onClick={() => setEditingFeed(feed)}
                      className="edit-button"
                      title="Edit feed"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => deleteFeed(feed.id, feed.name)}
                      className="delete-button"
                      title="Delete feed"
                    >
                      🗑️
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingFeed && (
        <div className="modal-overlay">
          <div className="add-feed-modal">
            <h3>Edit RSS Feed</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              updateFeed(editingFeed.id, editingFeed);
            }}>
              <div className="form-row">
                <label><strong>Feed ID:</strong> {editingFeed.feedId}</label>
              </div>
              <div className="form-row">
                <label>Name:</label>
                <input
                  type="text"
                  value={editingFeed.name}
                  onChange={(e) => setEditingFeed({...editingFeed, name: e.target.value})}
                  required
                />
              </div>
              <div className="form-row">
                <label>URL:</label>
                <input
                  type="url"
                  value={editingFeed.url}
                  onChange={(e) => setEditingFeed({...editingFeed, url: e.target.value})}
                  required
                />
              </div>
              <div className="form-row">
                <label>Priority (1-100):</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={editingFeed.priority}
                  onChange={(e) => setEditingFeed({...editingFeed, priority: parseInt(e.target.value)})}
                />
              </div>
              <div className="form-row">
                <label>Keywords (comma-separated):</label>
                <input
                  type="text"
                  value={editingFeed.keywords?.join(', ') || ''}
                  onChange={(e) => setEditingFeed({...editingFeed, keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k)})}
                />
                <small>Keywords help identify relevant articles from this feed</small>
              </div>
              <div className="form-row">
                <label>Scope:</label>
                <select
                  value={editingFeed.scope || 'generic'}
                  onChange={(e) => setEditingFeed({...editingFeed, scope: e.target.value})}
                >
                  <option value="generic">Generic (All relevant articles)</option>
                  <option value="team">Team-specific</option>
                  <option value="league">League-specific</option>
                  <option value="country">Country-specific</option>
                </select>
              </div>
              {(editingFeed.scope === 'team') && (
                <div className="form-row">
                  <label>Teams (comma-separated team IDs/slugs):</label>
                  <input
                    type="text"
                    value={editingFeed.teams?.join(', ') || ''}
                    onChange={(e) => setEditingFeed({...editingFeed, teams: e.target.value.split(',').map(t => t.trim()).filter(t => t)})}
                    placeholder="southampton, manchester-city"
                  />
                </div>
              )}
              {(editingFeed.scope === 'league') && (
                <div className="form-row">
                  <label>Leagues (comma-separated league IDs):</label>
                  <input
                    type="text"
                    value={editingFeed.leagues?.join(', ') || ''}
                    onChange={(e) => setEditingFeed({...editingFeed, leagues: e.target.value.split(',').map(l => l.trim()).filter(l => l)})}
                    placeholder="8, 9, 24"
                  />
                </div>
              )}
              {(editingFeed.scope === 'country') && (
                <div className="form-row">
                  <label>Countries (comma-separated country codes):</label>
                  <input
                    type="text"
                    value={editingFeed.countries?.join(', ') || ''}
                    onChange={(e) => setEditingFeed({...editingFeed, countries: e.target.value.split(',').map(c => c.trim()).filter(c => c)})}
                    placeholder="gb, es, it"
                  />
                </div>
              )}
              <div className="form-row">
                <label>Description:</label>
                <textarea
                  value={editingFeed.description || ''}
                  onChange={(e) => setEditingFeed({...editingFeed, description: e.target.value})}
                  rows="3"
                />
              </div>
              <div className="form-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={editingFeed.enabled}
                    onChange={(e) => setEditingFeed({...editingFeed, enabled: e.target.checked})}
                  />
                  <span>Enabled</span>
                </label>
              </div>
              <div className="modal-actions">
                <button type="submit" className="save-button">Update Feed</button>
                <button type="button" onClick={() => setEditingFeed(null)} className="cancel-button">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {feeds.length === 0 && !loading && (
        <div className="no-feeds">
          <p>No RSS feeds found.</p>
          <button onClick={() => setShowAddForm(true)} className="add-feed-button">
            Add Your First RSS Feed
          </button>
        </div>
      )}
    </div>
  );
};

export default RssManagement;
