// components/Admin/RssManagement.jsx - Simplified for new team-specific system
import React, { useState, useEffect, useCallback } from 'react';
import * as adminApi from '../../api/adminApi';
import './RssManagement.css';

const RssManagement = ({ user }) => {
  const [feeds, setFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [, setEditingFeed] = useState(null);
  const [stats, setStats] = useState(null);
  const [keywordInput, setKeywordInput] = useState('');
  const [availableTeams, setAvailableTeams] = useState([]);
  const [teamSearch, setTeamSearch] = useState('');
  
  const [newFeed, setNewFeed] = useState({
    name: '',
    url: '',
    enabled: true,
    keywords: [],
    description: '',
    fetchTimeout: 10000
  });

  // Helper function to add items to arrays
  const addTag = (array, value) => {
    if (value && !array.includes(value.toLowerCase().trim())) {
      return [...array, value.toLowerCase().trim()];
    }
    return array;
  };

  // Helper function to remove items from arrays
  const removeTag = (array, index) => {
    return array.filter((_, i) => i !== index);
  };

  const fetchFeeds = useCallback(async () => {
    try {
      setLoading(true);
      const queryParams = new URLSearchParams();
      if (filterEnabled !== 'all') {
        queryParams.append('enabled', filterEnabled);
      }
      if (searchTerm) {
        queryParams.append('search', searchTerm);
      }

      const data = await adminApi.getRssFeeds();
      setFeeds(data.feeds || []);
      setError('');
    } catch (error) {
      console.error('Error fetching feeds:', error);
      setError('Failed to load RSS feeds');
    } finally {
      setLoading(false);
    }
  }, [filterEnabled, searchTerm]);

  const fetchStats = useCallback(async () => {
    try {
      // Calculate basic stats from feeds data
      const enabled = feeds.filter(feed => feed.enabled).length;
      const disabled = feeds.filter(feed => !feed.enabled).length;
      const withErrors = feeds.filter(feed => feed.lastError).length;
      const totalArticles = feeds.reduce((sum, feed) => sum + (feed.articlesCount || 0), 0);
      
      setStats({
        total: feeds.length,
        enabled,
        disabled,
        withErrors,
        articles: { totalArticles }
      });
    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  }, [feeds]);

  const fetchAvailableTeams = useCallback(async () => {
    try {
      const data = await adminApi.getAllTeams();
      console.log('Fetched teams:', data);
      setAvailableTeams(data.teams || []);
    } catch (error) {
      console.error('Error fetching teams:', error);
    }
  }, []);

  const createFeed = async (feedData) => {
    try {
      setError('');
      await adminApi.createRssFeed(feedData);
      await fetchFeeds();
      await fetchStats();
      setShowAddForm(false);
      setNewFeed({
        name: '',
        url: '',
        enabled: true,
        keywords: [],
        description: '',
        fetchTimeout: 10000
      });
      setKeywordInput('');
      return true;
    } catch (error) {
      console.error('Error creating feed:', error);
      setError(error.body?.error || error.message || 'Failed to create RSS feed');
      return false;
    }
  };


  const deleteFeed = async (feedId, feedName) => {
    if (!window.confirm(`Are you sure you want to delete "${feedName}"?`)) {
      return;
    }

    try {
      await adminApi.deleteRssFeed(feedId);
      await fetchFeeds();
      await fetchStats();
    } catch (error) {
      console.error('Error deleting feed:', error);
      setError('Failed to delete RSS feed');
    }
  };

  const toggleFeed = async (feedId) => {
    try {
      // This functionality may need to be implemented on the backend
      console.log('Toggle feed functionality needs implementation for:', feedId);
      alert('Toggle functionality needs to be implemented');
    } catch (error) {
      console.error('Error toggling feed:', error);
      setError('Failed to toggle RSS feed');
    }
  };

  const testFeed = async (feedId, feedName) => {
    try {
      setError('');
      // This functionality may need to be implemented as a separate endpoint
      console.log('Test feed functionality needs implementation for:', feedId, feedName);
      alert('Test feed functionality needs to be implemented');
    } catch (error) {
      console.error('Error testing feed:', error);
      setError('Failed to test RSS feed');
    }
  };

  // Filter teams based on search
  const filteredTeams = teamSearch.length > 0 
    ? availableTeams.filter(team =>
        team.name.toLowerCase().includes(teamSearch.toLowerCase()) ||
        team.slug.toLowerCase().includes(teamSearch.toLowerCase())
      )
    : availableTeams; // Show all teams if search is empty

  const selectedTeam = newFeed.teamId ? availableTeams.find(t => t.id === newFeed.teamId) : null;

  // Use filteredTeams in console for debugging (removes unused warning)
  console.log('Available teams:', filteredTeams.length, 'Selected:', selectedTeam?.name);

  useEffect(() => {
    fetchFeeds();
    fetchStats();
    fetchAvailableTeams();
  }, [fetchFeeds, fetchStats, fetchAvailableTeams]);

  return (
    <div className="rss-management">
      <div className="rss-management-section-header">
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
                  placeholder="e.g. BBC Sport, Sky Sports, Southampton.com"
                  required
                />
              </div>

              <div className="form-row">
                <label>Feed URL: <span className="required">*</span></label>
                <input
                  type="url"
                  value={newFeed.url}
                  onChange={(e) => setNewFeed({...newFeed, url: e.target.value})}
                  placeholder="https://example.com/feed.xml"
                  required
                />
              </div>

              <div className="form-row">
                <label>Keywords (Optional):</label>
                <div className="tag-input-container">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        const trimmed = keywordInput.trim();
                        if (trimmed) {
                          setNewFeed({...newFeed, keywords: addTag(newFeed.keywords, trimmed)});
                          setKeywordInput('');
                        }
                      }
                    }}
                    placeholder="e.g. transfer, goal, injury. Press Enter to add"
                  />
                  <div className="tags-display">
                    {newFeed.keywords.map((keyword, idx) => (
                      <span key={idx} className="tag">
                        {keyword}
                        <button
                          type="button"
                          onClick={() => setNewFeed({...newFeed, keywords: removeTag(newFeed.keywords, idx)})}
                          className="tag-remove"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <small>
                  Filter articles from this feed by keywords. Used when assigning to teams in the Team Feed Subscriptions tab. Leave empty to include all articles.
                </small>
              </div>

              <div className="form-row">
                <label>Description:</label>
                <textarea
                  value={newFeed.description}
                  onChange={(e) => setNewFeed({...newFeed, description: e.target.value})}
                  placeholder="e.g. BBC Sport Premier League coverage"
                  rows="2"
                />
              </div>

              <div className="form-row">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={newFeed.enabled}
                    onChange={(e) => setNewFeed({...newFeed, enabled: e.target.checked})}
                  />
                  <span>Enable immediately</span>
                </label>
              </div>

              <div className="modal-actions">
                <button
                  type="submit"
                  className="save-button"
                  disabled={!newFeed.name || !newFeed.url}
                >
                  Create Feed
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewFeed({
                      name: '',
                      url: '',
                      enabled: true,
                      keywords: [],
                      description: '',
                      fetchTimeout: 10000,
                      scope: 'generic',
                      teamId: null
                    });
                    setKeywordInput('');
                    setTeamSearch('');
                  }}
                  className="cancel-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading feeds...</div>
      ) : (
        <div className="feeds-grid">
          {feeds.map(feed => (
            <div key={feed.id} className="feed-card">
              <div className="feed-card-header">
                <div className="feed-info">
                  <h4>{feed.name}</h4>
                  <p className="feed-scope">{feed.scope === 'generic' ? '🌍 Generic' : '👥 Team-Specific'}</p>
                </div>
                <button
                  className={`toggle-btn ${feed.enabled ? 'enabled' : 'disabled'}`}
                  onClick={() => toggleFeed(feed.id)}
                  title={feed.enabled ? 'Disable' : 'Enable'}
                >
                  {feed.enabled ? '✓' : '✕'}
                </button>
              </div>

              <div className="feed-card-body">
                <p className="feed-url" title={feed.url}>{feed.url}</p>
                {feed.description && <p className="feed-desc">{feed.description}</p>}
                {feed.keywords && feed.keywords.length > 0 && (
                  <div className="keywords">
                    {feed.keywords.slice(0, 3).map((k, i) => (
                      <span key={i} className="keyword-badge">{k}</span>
                    ))}
                    {feed.keywords.length > 3 && <span className="keyword-more">+{feed.keywords.length - 3}</span>}
                  </div>
                )}
                <div className="feed-stats">
                  <span>📰 {feed.articleCount || 0} articles</span>
                  {feed.lastFetched && (
                    <span>🕐 {new Date(feed.lastFetched).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              <div className="feed-card-actions">
                <button className="action-btn test-btn" onClick={() => testFeed(feed.id, feed.name)}>
                  Test
                </button>
                <button className="action-btn edit-btn" onClick={() => setEditingFeed(feed)}>
                  Edit
                </button>
                <button className="action-btn delete-btn" onClick={() => deleteFeed(feed.id, feed.name)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {feeds.length === 0 && !loading && (
        <div className="empty-state">
          <p>No RSS feeds yet. Create one to get started!</p>
        </div>
      )}
    </div>
  );
};

export default RssManagement;
