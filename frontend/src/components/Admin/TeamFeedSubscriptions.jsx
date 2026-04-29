// frontend/src/components/Admin/TeamFeedSubscriptions.jsx
import React, { useState, useEffect, useCallback } from 'react';
import * as adminApi from '../../api/adminApi';
import './TeamFeedSubscriptions.css';

const TeamFeedSubscriptions = ({ user }) => {
  const [subscriptions, setSubscriptions] = useState([]);
  const [availableFeeds, setAvailableFeeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState(''); // Local input state
  const [searchTerm, setSearchTerm] = useState(''); // Debounced search term
  const [editingTeam, setEditingTeam] = useState(null);
  const [filterEnabled, setFilterEnabled] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const LIMIT = 20;

  // Debounce search input - wait 500ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchTerm(searchInput);
      setPage(1); // Reset to page 1 on search
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const fetchSubscriptions = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (filterEnabled !== 'all') params.enabled = filterEnabled;
      params.page = page;
      params.limit = LIMIT;

      console.log('Fetching subscriptions with params:', params);
      
      const data = await adminApi.getTeamFeedSubscriptions(params);
      console.log('Subscriptions data:', data);
      setSubscriptions(data.subscriptions || []);
      setTotalPages(data.pagination?.pages || 1);
      setError('');
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setSubscriptions([]);
      setError(`Failed to load subscriptions: ${err.message || err.body?.error || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }, [searchTerm, filterEnabled, page]);

  const fetchAvailableFeeds = async () => {
    try {
      const data = await adminApi.getAvailableFeeds();
      console.log('Available feeds:', data);
      setAvailableFeeds(data.feeds || []);
    } catch (err) {
      console.error('Error fetching available feeds:', err);
      setError(`Failed to load available feeds: ${err.message || err.body?.error || 'Unknown error'}`);
    }
  };

  // Initial load: fetch subscriptions and feeds
  useEffect(() => {
    fetchSubscriptions();
    fetchAvailableFeeds();
  }, [fetchSubscriptions]); // Only run on mount

  // Search/filter/pagination: refetch subscriptions
  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const addFeedToTeam = async (teamId, feedId) => {
    try {
      await adminApi.addTeamFeedSubscription(teamId, feedId);
      setEditingTeam(null);
      await fetchSubscriptions();
      alert('Feed added successfully!');
    } catch (err) {
      console.error('Error adding feed:', err);
      alert(`Error: ${err.body?.error || err.message || 'Failed to add feed'}`);
    }
  };

  const removeFeedFromTeam = async (teamId, feedId) => {
    if (!window.confirm('Remove this feed from the team?')) return;

    try {
      await adminApi.removeTeamFeedSubscription(teamId, feedId);
      await fetchSubscriptions();
      alert('Feed removed successfully!');
    } catch (err) {
      console.error('Error removing feed:', err);
      alert(`Error: ${err.body?.error || err.message || 'Failed to remove feed'}`);
    }
  };

  // Note: toggleSubscription functionality may need to be implemented on backend
  const toggleSubscription = async (teamId) => {
    try {
      console.log('Toggle subscription for team:', teamId);
      alert('Toggle functionality needs to be implemented');
    } catch (err) {
      console.error('Error:', err);
    }
  };

  if (loading && subscriptions.length === 0) {
    return <div className="loading">Loading team subscriptions...</div>;
  }

  return (
    <div className="team-feed-subscriptions">
      <div className="subscriptions-header">
        <h2>Team RSS Feed Subscriptions</h2>
        <p className="subtitle">Assign RSS feeds to teams for dedicated news feeds</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filters-bar">
        <input
          type="text"
          placeholder="Search teams..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="search-input"
        />
        <select
          value={filterEnabled}
          onChange={(e) => {
            setFilterEnabled(e.target.value);
            setPage(1);
          }}
          className="filter-select"
        >
          <option value="all">All Teams</option>
          <option value="true">Enabled Only</option>
          <option value="false">Disabled Only</option>
        </select>
      </div>

      <div className="subscriptions-grid">
        {subscriptions.map(sub => (
          <div key={sub.id} className="subscription-card">
            <div className="card-header">
              <div className="team-info">
                <h3>{sub.teamName}</h3>
                <small>{sub.teamSlug}</small>
              </div>
              <button
                onClick={() => toggleSubscription(sub.teamId)}
                className={`toggle-btn ${sub.enabled ? 'enabled' : 'disabled'}`}
                title={sub.enabled ? 'Disable' : 'Enable'}
              >
                {sub.enabled ? '✓' : '✗'}
              </button>
            </div>

            <div className="card-stats">
              <span className="stat">
                <strong>{sub.feedCount}</strong> feeds
              </span>
              <span className="stat">
                <strong>{sub.articleCount}</strong> articles
              </span>
            </div>

            <div className="feeds-list">
              <div className="feeds-label">Assigned Feeds:</div>
              {sub.feeds.length === 0 ? (
                <p className="no-feeds">No feeds assigned</p>
              ) : (
                <ul>
                  {sub.feeds.map((feed, idx) => (
                    <li key={idx} className="feed-item">
                      <span>{feed.feedName}</span>
                      <button
                        onClick={() => removeFeedFromTeam(sub.teamId, feed.feedId)}
                        className="remove-btn"
                        title="Remove feed"
                      >
                        ×
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card-actions">
              <button
                onClick={() => setEditingTeam(editingTeam === sub.teamId ? null : sub.teamId)}
                className="edit-btn"
              >
                {editingTeam === sub.teamId ? 'Done' : 'Add Feed'}
              </button>
            </div>

            {editingTeam === sub.teamId && (
              <div className="add-feed-section">
                <select
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) {
                      addFeedToTeam(sub.teamId, e.target.value);
                      e.target.value = '';
                    }
                  }}
                  className="feed-select"
                >
                  <option value="">Select a feed...</option>
                  {availableFeeds
                    .filter(f => !sub.feeds.some(sf => sf.feedId === f.id))
                    .map(feed => (
                      <option key={feed.id} value={feed.id}>
                        {feed.name} ({feed.scope})
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>

      {subscriptions.length === 0 && !loading && (
        <div className="no-results">
          <p>No team subscriptions found.</p>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="page-btn"
          >
            ← Previous
          </button>
          <span className="page-info">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="page-btn"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
};

export default TeamFeedSubscriptions;
