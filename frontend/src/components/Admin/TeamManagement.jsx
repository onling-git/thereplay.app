// components/Admin/TeamManagement.jsx
import React, { useState, useEffect } from 'react';
import './TeamManagement.css';

const TeamManagement = ({ apiKey }) => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingTeam, setEditingTeam] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddReporter, setShowAddReporter] = useState(false);
  const [newReporter, setNewReporter] = useState({ name: '', handle: '', verified: false, follower_count: 0 });

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/admin/teams/teams`, {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTeams(data.teams || []);
        setError('');
      } else {
        throw new Error('Failed to fetch teams');
      }
    } catch (error) {
      console.error('Error fetching teams:', error);
      setError('Failed to load teams');
    } finally {
      setLoading(false);
    }
  };

  const updateTeamTwitter = async (teamId, twitterData) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/admin/teams/teams/${teamId}/twitter`, {
        method: 'PUT',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(twitterData)
      });

      if (response.ok) {
        await fetchTeams();
        setEditingTeam(null);
      } else {
        throw new Error('Failed to update team Twitter data');
      }
    } catch (error) {
      console.error('Error updating team:', error);
      setError('Failed to update team');
    }
  };

  const addReporter = async (teamId, reporterData) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/admin/teams/teams/${teamId}/reporters`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reporterData)
      });

      if (response.ok) {
        await fetchTeams();
        setShowAddReporter(false);
        setNewReporter({ name: '', handle: '', verified: false, follower_count: 0 });
      } else {
        throw new Error('Failed to add reporter');
      }
    } catch (error) {
      console.error('Error adding reporter:', error);
      setError('Failed to add reporter');
    }
  };

  const deleteReporter = async (teamId, reporterId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE}/api/admin/teams/teams/${teamId}/reporters/${reporterId}`, {
        method: 'DELETE',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        await fetchTeams();
      } else {
        throw new Error('Failed to delete reporter');
      }
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

      <div className="teams-table-container">
        <table className="teams-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Hashtag</th>
              <th>Tweet Fetch</th>
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
                    <input
                      type="text"
                      value={team.hashtag}
                      onChange={(e) => {
                        const updatedTeams = teams.map(t =>
                          t.id === team.id ? { ...t, hashtag: e.target.value } : t
                        );
                        setTeams(updatedTeams);
                      }}
                      placeholder="#teamhashtag"
                      className="hashtag-input"
                    />
                  ) : (
                    <span className={`hashtag ${team.hashtag ? 'set' : 'unset'}`}>
                      {team.hashtag || 'Not set'}
                    </span>
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
                            hashtag: team.hashtag,
                            tweet_fetch_enabled: team.tweet_fetch_enabled
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