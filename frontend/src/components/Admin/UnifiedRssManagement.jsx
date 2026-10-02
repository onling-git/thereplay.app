import React, { useState, useEffect, useCallback } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import * as adminApi from '../../api/adminApi';
import './UnifiedRssManagement.css';

const UnifiedRssManagement = ({ user }) => {
  const [teams, setTeams] = useState([]);
  const [feeds, setFeeds] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingTeam, setEditingTeam] = useState(null);
  const [showAddFeed, setShowAddFeed] = useState({});
  const [showGenericFeedForm, setShowGenericFeedForm] = useState(false);
  const [genericFeedsCollapsed, setGenericFeedsCollapsed] = useState(true); // Default to collapsed
  const [newFeed, setNewFeed] = useState({
    name: '',
    url: '',
    enabled: true,
    description: ''
  });

  const refreshData = useCallback(async () => {
    const [teamData, feedData, subscriptionData] = await Promise.all([
      adminApi.getAllTeams(),
      adminApi.getRssFeeds(),
      adminApi.getTeamFeedSubscriptions({ page: 1, limit: 100 })
    ]);
    const allSubscriptions = [...(subscriptionData.subscriptions || [])];
    for (let page = 2; page <= (subscriptionData.pagination?.pages || 1); page += 1) {
      const data = await adminApi.getTeamFeedSubscriptions({ page, limit: 100 });
      allSubscriptions.push(...(data.subscriptions || []));
    }
    setTeams(teamData.teams || []);
    setFeeds(feedData.feeds || []);
    setSubscriptions(allSubscriptions);
  }, []);

  const errorMessage = (error, fallback) => error.body?.message || error.body?.error || error.message || fallback;

  useEffect(() => {
    refreshData()
      .catch(error => setError(error.body?.message || error.body?.error || error.message || 'Failed to load RSS data'))
      .finally(() => setLoading(false));
  }, [refreshData]);

  const performAction = async (action, fallback) => {
    setSaving(true);
    setError('');
    try {
      await action();
      await refreshData();
      return true;
    } catch (error) {
      setError(errorMessage(error, fallback));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const createFeed = async (feedData, teamId = null) => {
    const success = await performAction(async () => {
      let feed = teamId ? feeds.find(existing => existing.url === feedData.url.trim()) : null;
      if (!feed) {
        const response = await adminApi.createRssFeed(feedData);
        feed = response.feed;
        setFeeds(current => [...current, feed]);
      }
      if (teamId) await adminApi.addTeamFeedSubscription(teamId, feed.id);
    }, 'Failed to create or assign RSS feed');
    if (success) {
      setShowAddFeed({});
      setShowGenericFeedForm(false);
      setNewFeed({
        name: '',
        url: '',
        enabled: true,
        description: ''
      });
    }
  };

  const deleteFeed = async (feedId, feedName) => {
    if (!window.confirm(`Are you sure you want to delete "${feedName}"?`)) {
      return;
    }

    await performAction(() => adminApi.deleteRssFeed(feedId), 'Failed to delete RSS feed');
  };

  const removeFeed = async (teamId, feed) => {
    if (!window.confirm(`Remove "${feed.name}" from this team?`)) return;
    await performAction(() => adminApi.removeTeamFeedSubscription(teamId, feed.id), 'Failed to remove team feed');
  };

  const toggleFeed = async (feed) => {
    await performAction(() => adminApi.updateRssFeed(feed.id, { enabled: !feed.enabled }), 'Failed to update RSS feed');
  };

  const renderFeedStatus = (feed) => (
    <label className="feed-enabled-control" title={`${feed.enabled ? 'Disable' : 'Enable'} ${feed.name} globally`}>
      <input
        type="checkbox"
        role="switch"
        className="feed-enabled-switch"
        aria-label={`Enable ${feed.name}`}
        checked={Boolean(feed.enabled)}
        disabled={saving}
        onChange={() => toggleFeed(feed)}
      />
      <span className={`status ${feed.enabled ? 'enabled' : 'disabled'}`}>{feed.enabled ? 'Active' : 'Inactive'}</span>
    </label>
  );

  const getTeamFeeds = (teamId) => {
    const subscription = subscriptions.find(item => String(item.teamId) === String(teamId));
    const assignedIds = new Set((subscription?.feeds || []).map(item => String(item.feedId)));
    return feeds.filter(feed => assignedIds.has(String(feed.id)));
  };

  const getGenericFeeds = () => {
    const assignedIds = new Set(subscriptions.flatMap(item => (item.feeds || []).map(feed => String(feed.feedId))));
    return feeds.filter(feed => !assignedIds.has(String(feed.id)));
  };

  const filteredTeams = teams.filter(team =>
    (team.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (team.slug || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="rss-team-management">
        <div className="loading">Loading RSS and team data...</div>
      </div>
    );
  }

  return (
    <div className="rss-team-management">
      <div className="rss-management-header">
        <h2>RSS Feed & Team Management</h2>
        <div className="header-controls">
          <div className="search-bar">
            <input
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => {
              setShowGenericFeedForm(true);
              setGenericFeedsCollapsed(false);
            }}
            className="generic-feed-btn"
            title="Add Generic RSS Feed"
            disabled={saving}
          >
            <Plus size={16} /> Generic Feed
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Generic Feeds Section */}
      <div className="generic-feeds-section">
        <div className="generic-feeds-header">
          <h3>Generic RSS Feeds (Unassigned)</h3>
          <button
            onClick={() => setGenericFeedsCollapsed(!genericFeedsCollapsed)}
            className="collapse-toggle"
            title={genericFeedsCollapsed ? "Expand generic feeds" : "Collapse generic feeds"}
          >
            {genericFeedsCollapsed ? "▶ Show Feeds" : "▼ Hide Feeds"}
          </button>
        </div>
        
        {!genericFeedsCollapsed && (
          <div className="generic-feeds-list">
          {getGenericFeeds().map(feed => (
            <div key={feed.id} className="generic-feed-card">
              <div className="feed-info">
                <strong>{feed.name}</strong>
                <span className="feed-url">{feed.url}</span>
                {feed.description && <p>{feed.description}</p>}
              </div>
              <div className="feed-actions">
                {renderFeedStatus(feed)}
                <button
                  onClick={() => deleteFeed(feed.id, feed.name)}
                  className="delete-btn"
                  title="Delete feed"
                  aria-label={`Delete ${feed.name}`}
                  disabled={saving}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          
          {showGenericFeedForm && (
            <div className="add-feed-form generic-form">
              <h4>Add Generic RSS Feed</h4>
              <div className="form-fields">
                <input
                  type="text"
                  placeholder="Feed name"
                  value={newFeed.name}
                  onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                />
                <input
                  type="url"
                  placeholder="RSS Feed URL"
                  value={newFeed.url}
                  onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newFeed.description}
                  onChange={(e) => setNewFeed({ ...newFeed, description: e.target.value })}
                />
                <div className="form-actions">
                  <button
                    onClick={() => createFeed(newFeed)}
                    className="save-btn"
                    disabled={saving || !newFeed.name.trim() || !newFeed.url.trim()}
                  >
                    Add Feed
                  </button>
                  <button
                    onClick={() => {
                      setShowGenericFeedForm(false);
                      setNewFeed({ name: '', url: '', enabled: true, description: '' });
                    }}
                    className="cancel-btn"
                    disabled={saving}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
          </div>
        )}
      </div>

      {/* Teams Table */}
      <div className="teams-table-container">
            <table className="teams-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>RSS Feeds</th>
              <th>Feed Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeams.map(team => {
              const teamFeeds = getTeamFeeds(team.id);
              return (
                <tr key={team.id} className={`team-row ${editingTeam === team.id ? 'editing' : ''}`}>
                  <td>
                    <div className="team-info">
                      <strong>{team.name}</strong>
                      <small>/{team.slug}</small>
                    </div>
                  </td>
                  <td>
                    <div className="feeds-cell">
                      <div className="feeds-list">
                        {teamFeeds.length > 0 ? (
                          teamFeeds.map(feed => (
                            <div key={feed.id} className="feed-badge">
                              <span className="feed-name">{feed.name}</span>
                              <span className="feed-url">{feed.url}</span>
                              {renderFeedStatus(feed)}
                              {editingTeam === team.id && (
                                <button
                                  onClick={() => removeFeed(team.id, feed)}
                                  className="delete-feed-btn"
                                  title="Remove feed"
                                  aria-label={`Remove ${feed.name} from ${team.name}`}
                                  disabled={saving}
                                >
                                  <X size={16} />
                                </button>
                              )}
                            </div>
                          ))
                        ) : (
                          <span className="no-feeds">No RSS feeds</span>
                        )}
                      </div>
                      
                      {editingTeam === team.id && (
                        <>
                          <select
                            className="existing-feed-select"
                            aria-label={`Assign existing feed to ${team.name}`}
                            value=""
                            disabled={saving}
                            onChange={event => {
                              const feedId = event.target.value;
                              if (feedId) performAction(() => adminApi.addTeamFeedSubscription(team.id, feedId), 'Failed to assign RSS feed');
                            }}
                          >
                            <option value="">Assign existing feed...</option>
                            {feeds.filter(feed => !teamFeeds.some(assigned => assigned.id === feed.id)).map(feed => (
                              <option key={feed.id} value={feed.id}>{feed.name}</option>
                            ))}
                          </select>
                          {showAddFeed[team.id] ? (
                            <div className="add-feed-inline">
                              <input
                                type="text"
                                placeholder="Feed name"
                                value={newFeed.name}
                                onChange={(e) => setNewFeed({ ...newFeed, name: e.target.value })}
                                className="feed-input"
                              />
                              <input
                                type="url"
                                placeholder="RSS Feed URL"
                                value={newFeed.url}
                                onChange={(e) => setNewFeed({ ...newFeed, url: e.target.value })}
                                className="feed-input"
                              />
                              <div className="feed-actions">
                                <button
                                  onClick={() => createFeed(newFeed, team.id)}
                                  className="add-btn"
                                  title="Save team feed"
                                  aria-label={`Save feed for ${team.name}`}
                                  disabled={saving || !newFeed.name.trim() || !newFeed.url.trim()}
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  onClick={() => {
                                    setShowAddFeed({ ...showAddFeed, [team.id]: false });
                                    setNewFeed({ name: '', url: '', enabled: true, description: '' });
                                  }}
                                  className="cancel-btn"
                                  title="Cancel new feed"
                                  disabled={saving}
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowAddFeed({ ...showAddFeed, [team.id]: true })}
                              className="add-feed-btn"
                              disabled={saving}
                            >
                              <Plus size={16} /> Add Feed
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={`feed-count ${teamFeeds.length > 0 ? 'has-feeds' : 'no-feeds'}`}>
                      {teamFeeds.length} feed{teamFeeds.length !== 1 ? 's' : ''}
                    </span>
                  </td>
                  <td>
                    <div className="action-buttons">
                      {editingTeam === team.id ? (
                        <>
                          <button
                            onClick={() => {
                              setEditingTeam(null);
                              setShowAddFeed({});
                            }}
                            className="save-btn"
                            title="Done editing"
                            disabled={saving}
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingTeam(null);
                              setShowAddFeed({});
                            }}
                            className="cancel-btn"
                            title="Cancel editing"
                            disabled={saving}
                          >
                            <X size={16} />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditingTeam(team.id)}
                          className="edit-btn"
                          title="Edit RSS feeds"
                          aria-label={`Edit RSS feeds for ${team.name}`}
                          disabled={saving}
                        >
                          <Pencil size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
      </div>

      {teams.length === 0 && !loading && (
        <div className="no-teams">
          <p>No teams found.</p>
        </div>
      )}
    </div>
  );
};

export default UnifiedRssManagement;