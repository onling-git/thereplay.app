// components/Admin/TeamManagement.jsx
import React, { useState, useEffect } from 'react';
import * as adminApi from '../../api/adminApi';
import './TeamManagement.css';

const TeamManagement = ({ user }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [editingTeam, setEditingTeam] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddReporter, setShowAddReporter] = useState(false);
  const [newReporter, setNewReporter] = useState({ name: '', handle: '', verified: false, follower_count: 0 });
  const [hashtagInput, setHashtagInput] = useState('');

  // Helper function to add hashtags
  const addHashtag = (teamId, value) => {
    if (!value) return;
    
    const trimmed = value.trim();
    // Ensure hashtag starts with #
    const hashtag = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    
    const updatedTeams = teams.map(t => {
      if (t.id === teamId) {
        const allHashtags = t.alternative_hashtags || [];
        // Don't add duplicates
        if (!allHashtags.includes(hashtag)) {
          return { ...t, alternative_hashtags: [...allHashtags, hashtag] };
        }
      }
      return t;
    });
    setTeams(updatedTeams);
  };

  // Helper function to remove hashtags
  const removeHashtag = (teamId, index) => {
    const updatedTeams = teams.map(t => {
      if (t.id === teamId) {
        const allHashtags = t.alternative_hashtags || [];
        return { ...t, alternative_hashtags: allHashtags.filter((_, i) => i !== index) };
      }
      return t;
    });
    setTeams(updatedTeams);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const data = await adminApi.getAllTeams();
      // Ensure alternative_hashtags is initialized as an array
      const teamsWithHashtags = (data.teams || []).map(team => ({
        ...team,
        alternative_hashtags: team.alternative_hashtags || [],
        hashtag_feed_enabled: team.hashtag_feed_enabled || false,
        feed_hashtag: team.feed_hashtag || ''
      }));
      setTeams(teamsWithHashtags);
      setError('');
    } catch (error) {
      console.error('Error fetching teams:', error);
      setError('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const updateTeamTwitter = async (teamId, twitterData) => {
    try {
      setError('');
      setSuccessMessage('');
      
      // Normalize feed_hashtag to ensure it starts with #
      if (twitterData.feed_hashtag && twitterData.feed_hashtag.trim()) {
        const hashtag = twitterData.feed_hashtag.trim();
        twitterData.feed_hashtag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
      }
      
      console.log('[TeamManagement] Updating team:', teamId, twitterData);
      
      const result = await adminApi.updateTeamTwitter(teamId, twitterData);
      console.log('[TeamManagement] Update result:', result);
      
      await fetchTeams(); // Refresh the list
      setEditingTeam(null);
      setSuccessMessage('Team settings updated successfully!');
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error updating team Twitter data:', error);
      const errorMessage = error.body?.error || error.message || 'Unknown error';
      setError('Failed to update team Twitter data: ' + errorMessage);
    }
  };

  const addReporter = async (teamId, reporterData) => {
    try {
      await adminApi.addTeamReporter(teamId, reporterData);
      await fetchTeams();
      setShowAddReporter(false);
      setNewReporter({ name: '', handle: '', verified: false, follower_count: 0 });
    } catch (error) {
      console.error('Error adding reporter:', error);
      setError('Failed to add reporter');
    }
  };

  const deleteReporter = async (teamId, reporterId) => {
    try {
      await adminApi.removeTeamReporter(teamId, reporterId);
      await fetchTeams();
    } catch (error) {
      console.error('Error deleting reporter:', error);
      setError('Failed to delete reporter');
    }
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.slug.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="team-management">
        <div className="loading">Loading teams...</div>
      </div>
    );
  }

  return (
    <div className="team-management">
      <div className="team-management-header">
        <h2>Team Twitter Management</h2>
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search teams..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="success-message">
          {successMessage}
        </div>
      )}

      <div className="teams-table-container">
        <table className="teams-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Hashtags</th>
              <th>Tweet Fetch</th>
              <th>Fan Feed</th>
              <th>Reporters</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTeams.map(team => (
              <tr key={team.id} className={`team-row ${editingTeam === team.id ? 'editing' : ''}`}>
                <td>
                  <div className="team-info">
                    <strong>{team.name}</strong>
                    <small>/{team.slug}</small>
                  </div>
                </td>
                <td>
                  {editingTeam === team.id ? (
                    <div className="hashtag-editor">
                      <div className="tag-input-container">
                        <input
                          type="text"
                          value={hashtagInput}
                          onChange={(e) => setHashtagInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ',') {
                              e.preventDefault();
                              const trimmed = hashtagInput.trim();
                              if (trimmed) {
                                addHashtag(team.id, trimmed);
                                setHashtagInput('');
                              }
                            }
                          }}
                          placeholder="#hashtag - Press Enter to add"
                          className="hashtag-input"
                        />
                        <div className="tags-display">
                          {(team.alternative_hashtags || []).map((hashtag, idx) => (
                            <span key={idx} className="tag">
                              {hashtag}
                              <button
                                type="button"
                                onClick={() => removeHashtag(team.id, idx)}
                                className="tag-remove"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                      <small className="hint">Add multiple hashtags. Press Enter or comma to add each one.</small>
                    </div>
                  ) : (
                    <div className="hashtags-display">
                      {(team.alternative_hashtags || []).length > 0 ? (
                        (team.alternative_hashtags || []).map((hashtag, idx) => (
                          <span key={idx} className="hashtag-chip">
                            {hashtag}
                          </span>
                        ))
                      ) : (
                        <span className="hashtag unset">Not set</span>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  {editingTeam === team.id ? (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={team.tweet_fetch_enabled}
                        onChange={(e) => {
                          const updatedTeams = teams.map(t =>
                            t.id === team.id ? { ...t, tweet_fetch_enabled: e.target.checked } : t
                          );
                          setTeams(updatedTeams);
                        }}
                      />
                      <span>Enabled</span>
                    </label>
                  ) : (
                    <span className={`status ${team.tweet_fetch_enabled ? 'enabled' : 'disabled'}`}>
                      {team.tweet_fetch_enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  )}
                </td>
                <td>
                  {editingTeam === team.id ? (
                    <div className="fan-feed-editor">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={team.hashtag_feed_enabled}
                          onChange={(e) => {
                            const updatedTeams = teams.map(t =>
                              t.id === team.id ? { ...t, hashtag_feed_enabled: e.target.checked } : t
                            );
                            setTeams(updatedTeams);
                          }}
                        />
                        <span>Enabled</span>
                      </label>
                      <input
                        type="text"
                        value={team.feed_hashtag || ''}
                        onChange={(e) => {
                          const updatedTeams = teams.map(t =>
                            t.id === team.id ? { ...t, feed_hashtag: e.target.value } : t
                          );
                          setTeams(updatedTeams);
                        }}
                        placeholder="#pompey"
                        className="hashtag-input"
                        style={{ marginTop: '0.5rem' }}
                      />
                      <small className="hint">Fan feed hashtag</small>
                    </div>
                  ) : (
                    <div className="fan-feed-display">
                      <span className={`status ${team.hashtag_feed_enabled ? 'enabled' : 'disabled'}`}>
                        {team.hashtag_feed_enabled ? 'Enabled' : 'Disabled'}
                      </span>
                      {team.feed_hashtag && (
                        <div className="hashtag-chip" style={{ marginTop: '0.25rem' }}>
                          {team.feed_hashtag}
                        </div>
                      )}
                    </div>
                  )}
                </td>
                <td>
                  <div className="reporters-cell">
                    <div className="reporters-list">
                      {team.reporters && team.reporters.length > 0 ? (
                        team.reporters.map((reporter, index) => (
                          <div key={index} className="reporter-badge">
                            <span className="reporter-name">{reporter.name}</span>
                            <span className="reporter-handle">{reporter.handle}</span>
                            {editingTeam === team.id && (
                              <button
                                onClick={() => deleteReporter(team.id, reporter._id)}
                                className="delete-reporter-btn"
                                title="Remove reporter"
                              >
                                ×
                              </button>
                            )}
                          </div>
                        ))
                      ) : (
                        <span className="no-reporters">No reporters</span>
                      )}
                    </div>
                    {editingTeam === team.id && (
                      <>
                        {showAddReporter === team.id ? (
                          <div className="add-reporter-inline">
                            <input
                              type="text"
                              placeholder="Reporter name"
                              value={newReporter.name}
                              onChange={(e) => setNewReporter({ ...newReporter, name: e.target.value })}
                              className="reporter-input"
                            />
                            <input
                              type="text"
                              placeholder="@handle"
                              value={newReporter.handle}
                              onChange={(e) => setNewReporter({ ...newReporter, handle: e.target.value })}
                              className="reporter-input"
                            />
                            <div className="reporter-actions">
                              <button
                                onClick={() => addReporter(team.id, newReporter)}
                                className="add-btn"
                              >
                                ✓
                              </button>
                              <button
                                onClick={() => {
                                  setShowAddReporter(false);
                                  setNewReporter({ name: '', handle: '', verified: false, follower_count: 0 });
                                }}
                                className="cancel-btn"
                              >
                                ×
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowAddReporter(team.id)}
                            className="add-reporter-btn"
                          >
                            + Add Reporter
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
                <td>
                  <div className="action-buttons">
                    {editingTeam === team.id ? (
                      <>
                        <button
                          onClick={() => updateTeamTwitter(team.id, {
                            alternative_hashtags: team.alternative_hashtags,
                            tweet_fetch_enabled: team.tweet_fetch_enabled,
                            hashtag_feed_enabled: team.hashtag_feed_enabled,
                            feed_hashtag: team.feed_hashtag
                          })}
                          className="save-btn"
                          title="Save changes"
                        >
                          💾
                        </button>
                        <button
                          onClick={() => {
                            setEditingTeam(null);
                            setShowAddReporter(false);
                            fetchTeams(); // Reset changes
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
                        title="Edit team settings"
                      >
                        ✏️
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
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

export default TeamManagement;