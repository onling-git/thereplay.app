// src/pages/TeamPreferences.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { Heart, Plus, Settings, X } from 'lucide-react';
import TeamSelection from '../components/TeamSelection/TeamSelection';
import * as authAPI from '../api/auth.js';
import { getTeams } from '../api.js';
import './css/TeamPreferences.css';

const TeamPreferences = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [selectionMode, setSelectionMode] = useState('both');
  const [favoriteTeam, setFavoriteTeam] = useState(null);
  const [followedTeams, setFollowedTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isAuthenticated) {
      loadTeamPreferences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // Only reload when auth status changes, not on every user update

  const loadTeamPreferences = async () => {
    try {
      setLoading(true);
      const response = await authAPI.getTeamPreferences();
      
      if (response?.data?.team_preferences) {
        const prefs = response.data.team_preferences;
        
        // Collect team IDs to fetch details for
        const teamIds = [];
        if (prefs.favourite_team && typeof prefs.favourite_team === 'number') {
          teamIds.push(prefs.favourite_team);
        }
        if (prefs.followed_teams && Array.isArray(prefs.followed_teams)) {
          prefs.followed_teams.forEach(teamId => {
            if (typeof teamId === 'number' && !teamIds.includes(teamId)) {
              teamIds.push(teamId);
            }
          });
        }

        // Fetch team details if we have IDs
        if (teamIds.length > 0) {
          try {
            const teamsResponse = await getTeams({ limit: 1000 }); // Get more teams since it's paginated
            const allTeams = teamsResponse?.teams || teamsResponse || [];
            
            // Set favorite team with full details
            if (prefs.favourite_team && typeof prefs.favourite_team === 'number') {
              const favoriteTeamData = allTeams.find(team => team.id === prefs.favourite_team);
              setFavoriteTeam(favoriteTeamData || { id: prefs.favourite_team, name: `Team ${prefs.favourite_team}` });
            } else {
              setFavoriteTeam(prefs.favourite_team); // In case it's already an object or null
            }
            
            // Set followed teams with full details
            if (prefs.followed_teams && Array.isArray(prefs.followed_teams)) {
              const followedTeamsData = prefs.followed_teams.map(teamId => {
                if (typeof teamId === 'number') {
                  const teamData = allTeams.find(team => team.id === teamId);
                  return teamData || { id: teamId, name: `Team ${teamId}` };
                }
                return teamId; // In case it's already an object
              });
              setFollowedTeams(followedTeamsData);
            } else {
              setFollowedTeams([]);
            }
          } catch (teamFetchError) {
            console.error('Failed to fetch team details:', teamFetchError);
            // Set fallback data with IDs
            if (prefs.favourite_team && typeof prefs.favourite_team === 'number') {
              setFavoriteTeam({ id: prefs.favourite_team, name: `Team ${prefs.favourite_team}` });
            }
            if (prefs.followed_teams && Array.isArray(prefs.followed_teams)) {
              const fallbackFollowed = prefs.followed_teams.map(teamId => 
                typeof teamId === 'number' ? { id: teamId, name: `Team ${teamId}` } : teamId
              );
              setFollowedTeams(fallbackFollowed);
            }
          }
        } else {
          // No teams to fetch, set empty/null values
          setFavoriteTeam(prefs.favourite_team);
          setFollowedTeams(prefs.followed_teams || []);
        }
      }
    } catch (error) {
      console.error('Failed to load team preferences:', error);
      setMessage('Failed to load team preferences');
    } finally {
      setLoading(false);
    }
  };

  const openTeamSelection = (mode) => {
    setSelectionMode(mode);
    setShowTeamSelection(true);
  };

  const handleTeamSelection = async (data) => {
    setSaving(true);
    setMessage('');
    
    try {
      // Only send IDs to the API
      const apiData = {
        favourite_team: data.favourite_team,
        followed_teams: data.followed_teams
      };
      await authAPI.updateTeamPreferences(apiData);
      
      // Update local state with full team objects if available
      if (data.favourite_team !== undefined) {
        setFavoriteTeam(data.favourite_team_obj || (data.favourite_team ? { id: data.favourite_team } : null));
      }
      
      if (data.followed_teams !== undefined) {
        setFollowedTeams(data.followed_teams_objs || data.followed_teams.map(id => ({ id })));
      }
      
      // Don't call updateProfile here - it would trigger a reload and lose team names
      
      setMessage('Team preferences updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to update team preferences:', error);
      setMessage('Failed to update team preferences. Please try again.');
    } finally {
      setSaving(false);
      setShowTeamSelection(false);
    }
  };

  const removeFavoriteTeam = async () => {
    setSaving(true);
    try {
      await authAPI.updateTeamPreferences({ favourite_team: null });
      setFavoriteTeam(null);
      setMessage('Favorite team removed successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to remove favorite team:', error);
      setMessage('Failed to remove favorite team. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeFollowedTeam = async (teamId) => {
    setSaving(true);
    try {
      const updatedFollowed = followedTeams.filter(team => team.id !== teamId);
      await authAPI.updateTeamPreferences({ 
        followed_teams: updatedFollowed.map(t => t.id)
      });
      setFollowedTeams(updatedFollowed);
      setMessage('Team removed from following list!');
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Failed to remove followed team:', error);
      setMessage('Failed to remove team. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="team-preferences-page">
        <div className="team-preferences-container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="team-preferences-page">
        <div className="team-preferences-container">
          <div className="auth-required">
            <h2>Sign In Required</h2>
            <p>You need to be signed in to manage your team preferences.</p>
            <a href="/account" className="back-to-account">Go to Account</a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="team-preferences-page">
        <div className="team-preferences-container">
          <div className="team-preferences-header">
            <div className="header-content">
              <h1>Team Preferences</h1>
              <p>Manage your favorite team and teams you follow for personalized content</p>
            </div>
            <a href="/account" className="back-to-account">← Back to Account</a>
          </div>

          {message && (
            <div className={`message ${message.includes('successfully') || message.includes('removed') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <div className="preferences-sections">
            {/* Favorite Team Section */}
            <div className="preference-section favorite-section">
              <div className="section-header">
                <div className="section-title">
                  <Heart className="section-icon favorite" size={24} />
                  <div>
                    <h2>Favorite Team</h2>
                    <p>Your primary team - gets priority in updates and appears on your home screen</p>
                  </div>
                </div>
                <button 
                  onClick={() => openTeamSelection('favorite')}
                  disabled={saving}
                  // className="manage-btn"
                  className="btn"
                >
                  <Settings size={16} />
                  Manage
                </button>
              </div>
              
              <div className="current-selection">
                {favoriteTeam ? (
                  <div className="team-card favorite">
                    {favoriteTeam.image_path && (
                      <img 
                        src={favoriteTeam.image_path} 
                        alt={favoriteTeam.name}
                        className="team-logo"
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}
                    <div className="team-info">
                      <h3>{favoriteTeam.name || `Team ${favoriteTeam.id}`}</h3>
                      {favoriteTeam.short_code && (
                        <span className="team-code">{favoriteTeam.short_code}</span>
                      )}
                    </div>
                    <button 
                      onClick={removeFavoriteTeam}
                      disabled={saving}
                      // className="remove-btn"
                      className="btn"
                      title="Remove favorite team"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="no-selection">
                    <Heart className="empty-icon" size={32} />
                    <div className="empty-text">
                      <h3>No Favorite Team Selected</h3>
                      <p>Choose a team to get personalized content and priority updates</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Followed Teams Section */}
            <div className="preference-section followed-section">
              <div className="section-header">
                <div className="section-title">
                  <Plus className="section-icon followed" size={24} />
                  <div>
                    <h2>Followed Teams</h2>
                    <p>Additional teams you follow for news and updates</p>
                  </div>
                </div>
                <button 
                  onClick={() => openTeamSelection('followed')}
                  disabled={saving}
                  // className="manage-btn"
                  className="btn"
                >
                  <Settings size={16} />
                  Manage
                </button>
              </div>
              
              <div className="current-selection">
                {followedTeams.length > 0 ? (
                  <div className="followed-teams-grid">
                    {followedTeams.map(team => (
                      <div key={team.id} className="team-card followed">
                        {team.image_path && (
                          <img 
                            src={team.image_path} 
                            alt={team.name}
                            className="team-logo"
                            onError={(e) => e.target.style.display = 'none'}
                          />
                        )}
                        <div className="team-info">
                          <h4>{team.name || `Team ${team.id}`}</h4>
                          {team.short_code && (
                            <span className="team-code">{team.short_code}</span>
                          )}
                        </div>
                        <button 
                          onClick={() => removeFollowedTeam(team.id)}
                          disabled={saving}
                          // className="remove-btn"
                          className="btn"
                          title="Stop following this team"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="no-selection">
                    <Plus className="empty-icon" size={32} />
                    <div className="empty-text">
                      <h3>No Teams Followed</h3>
                      <p>Follow additional teams to get their news and match updates</p>
                    </div>
                  </div>
                )}
              </div>
              
              {followedTeams.length > 0 && (
                <div className="section-stats">
                  <span>Following {followedTeams.length} team{followedTeams.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Team Selection Modal */}
      <TeamSelection
        isOpen={showTeamSelection}
        onClose={() => setShowTeamSelection(false)}
        onSave={handleTeamSelection}
        initialFavorite={favoriteTeam}
        initialFollowed={followedTeams}
        mode={selectionMode}
      />
    </>
  );
};

export default TeamPreferences;