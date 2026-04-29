import React, { useState, useEffect } from 'react';
import * as adminApi from '../../api/adminApi';
import './UnifiedRssManagement.css';

const UnifiedRssManagement = ({ user }) => {
  const [teams, setTeams] = useState([]);
  const [feeds, setFeeds] = useState([]);
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
    description: '',
    team_id: null
  });

  useEffect(() => {
    fetchTeams();
    fetchFeeds();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAllTeams();
      setTeams(data.teams || []);
      setError('');
    } catch (error) {
      console.error('Error fetching teams:', error);
      setError('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const fetchFeeds = async () => {
    try {
      const data = await adminApi.getRssFeeds();
      setFeeds(data.feeds || []);
    } catch (error) {
      console.error('Error fetching feeds:', error);
      setError('Failed to load RSS feeds');
    }
  };

  const createFeed = async (feedData) => {
    try {
      await adminApi.createRssFeed(feedData);
      await fetchFeeds();
      setShowAddFeed({});
      setShowGenericFeedForm(false);
      setNewFeed({
        name: '',
        url: '',
        enabled: true,
        description: '',
        team_id: null
      });
    } catch (error) {
      console.error('Error creating feed:', error);
      setError('Failed to create RSS feed');
    }
  };

  const deleteFeed = async (feedId, feedName) => {
    if (!window.confirm(`Are you sure you want to delete "${feedName}"?`)) {
      return;
    }

    try {
      await adminApi.deleteRssFeed(feedId);
      await fetchFeeds();
    } catch (error) {
      console.error('Error deleting feed:', error);
      setError('Failed to delete RSS feed');
    }
  };

  const getTeamFeeds = (teamId) => {
    return feeds.filter(feed => feed.team_id === teamId);
  };

  const getGenericFeeds = () => {
    return feeds.filter(feed => !feed.team_id);
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.slug.toLowerCase().includes(searchTerm.toLowerCase())
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
            onClick={() => setShowGenericFeedForm(true)}
            className="generic-feed-btn"
            title="Add Generic RSS Feed"
          >
            + Generic Feed
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
          <h3>Generic RSS Feeds (All Teams)</h3>
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
            <div key={feed._id} className="generic-feed-card">
              <div className="feed-info">
                <strong>{feed.name}</strong>
                <span className="feed-url">{feed.url}</span>
                {feed.description && <p>{feed.description}</p>}
              </div>
              <div className="feed-actions">
                <span className={`status ${feed.enabled ? 'enabled' : 'disabled'}`}>
                  {feed.enabled ? 'Active' : 'Inactive'}
                </span>
                <button
                  onClick={() => deleteFeed(feed._id, feed.name)}
                  className="delete-btn"
                  title="Delete feed"
                >
                  🗑️
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
                    onClick={() => createFeed({ ...newFeed, team_id: null })}
                    className="save-btn"
                  >
                    Add Feed
                  </button>
                  <button
                    onClick={() => {
                      setShowGenericFeedForm(false);
                      setNewFeed({ name: '', url: '', enabled: true, description: '', team_id: null });
                    }}
                    className="cancel-btn"
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
                            <div key={feed._id} className="feed-badge">
                              <span className="feed-name">{feed.name}</span>
                              <span className="feed-url">{feed.url}</span>
                              {editingTeam === team.id && (
                                <button
                                  onClick={() => deleteFeed(feed._id, feed.name)}
                                  className="delete-feed-btn"
                                  title="Remove feed"
                                >
                                  ×
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
                                  onClick={() => createFeed({ ...newFeed, team_id: team.id })}
                                  className="add-btn"
                                >
                                  ✓
                                </button>
                                <button
                                  onClick={() => {
                                    setShowAddFeed({ ...showAddFeed, [team.id]: false });
                                    setNewFeed({ name: '', url: '', enabled: true, description: '', team_id: null });
                                  }}
                                  className="cancel-btn"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowAddFeed({ ...showAddFeed, [team.id]: true })}
                              className="add-feed-btn"
                            >
                              + Add Feed
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
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => {
                              setEditingTeam(null);
                              setShowAddFeed({});
                              fetchFeeds(); // Reset changes
                            }}
                            className="cancel-btn"
                            title="Cancel editing"
                          >
                            ✖
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setEditingTeam(team.id)}
                          className="edit-btn"
                          title="Edit RSS feeds"
                        >
                          ✏️
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