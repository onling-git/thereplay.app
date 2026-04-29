// src/pages/Account.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import AuthModal from '../components/Auth/AuthModal';
import { CookieSettingsSection } from '../components/CookieConsent';
import { getTeams } from '../api.js';
import './css/Account.css';

const Account = () => {
  const { user, isAuthenticated, loading, updateProfile, checkAuthStatus } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    surname: '',
    display_name: '',
    phone: '',
    country: '',
    bio: ''
  });
  const [message, setMessage] = useState('');
  const [updating, setUpdating] = useState(false);
  const [teamNames, setTeamNames] = useState({});
  const [loadingTeamNames, setLoadingTeamNames] = useState(false);

  // Check auth status when component mounts - only if not already authenticated
  React.useEffect(() => {
    console.log('🏠 Account page mounted, checking auth status...');
    if (!loading && !isAuthenticated) {
      checkAuthStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array to run only once on mount

  React.useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || '',
        surname: user.surname || '',
        display_name: user.display_name || '',
        phone: user.phone || '',
        country: user.country || '',
        bio: user.bio || ''
      });
    }
  }, [user]);

  // Fetch team names for user's team preferences
  useEffect(() => {
    const fetchTeamNames = async () => {
      if (!user || (!user.favourite_team && (!user.followed_teams || user.followed_teams.length === 0))) {
        return;
      }

      console.log('🔍 Account: Starting to fetch team names for user:', user);
      console.log('🔍 Account: Favourite team value:', user.favourite_team, 'Type:', typeof user.favourite_team);
      console.log('🔍 Account: Followed teams:', user.followed_teams);

      setLoadingTeamNames(true);
      try {
        // Get all team IDs we need to fetch
        const teamIds = [];
        if (user.favourite_team && typeof user.favourite_team === 'number') {
          teamIds.push(user.favourite_team);
        }
        if (user.followed_teams && Array.isArray(user.followed_teams)) {
          user.followed_teams.forEach(teamId => {
            if (typeof teamId === 'number' && !teamIds.includes(teamId)) {
              teamIds.push(teamId);
            }
          });
        }

        console.log('🔍 Account: Team IDs to fetch:', teamIds);

        if (teamIds.length > 0) {
          // Fetch teams from API - get more teams since it's paginated
          console.log('🔍 Account: Calling getTeams API with larger limit...');
          const teamsResponse = await getTeams({ limit: 1000 }); // Get more teams
          console.log('🔍 Account: Teams API response:', teamsResponse);
          
          const allTeams = teamsResponse?.teams || teamsResponse || [];
          console.log('🔍 Account: Total teams returned:', allTeams.length);
          
          // Create a mapping of team ID to team name
          const nameMapping = {};
          teamIds.forEach(id => {
            const team = allTeams.find(team => team.id === id);
            console.log(`🔍 Account: Looking for team ID ${id}, found:`, team);
            if (team) {
              nameMapping[id] = team.name;
            } else {
              nameMapping[id] = `Team ${id}`; // Fallback name
            }
          });
          
          console.log('🔍 Account: Final name mapping:', nameMapping);
          setTeamNames(nameMapping);
        }
      } catch (error) {
        console.error('❌ Account: Failed to fetch team names:', error);
        // Set fallback names
        const fallbackNames = {};
        if (user.favourite_team && typeof user.favourite_team === 'number') {
          fallbackNames[user.favourite_team] = `Team ${user.favourite_team}`;
        }
        if (user.followed_teams && Array.isArray(user.followed_teams)) {
          user.followed_teams.forEach(teamId => {
            if (typeof teamId === 'number') {
              fallbackNames[teamId] = `Team ${teamId}`;
            }
          });
        }
        console.log('🔍 Account: Using fallback names:', fallbackNames);
        setTeamNames(fallbackNames);
      } finally {
        setLoadingTeamNames(false);
      }
    };

    fetchTeamNames();
  }, [user]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setMessage('');

    try {
      const result = await updateProfile(formData);
      if (result.success) {
        setMessage('Profile updated successfully!');
        setEditMode(false);
      } else {
        setMessage(result.error || 'Failed to update profile');
      }
    } catch (error) {
      setMessage('An unexpected error occurred');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="account-page">
        <div className="account-container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <div className="account-page">
          <div className="account-container">
            <div className="auth-required">
              <h2>Account Access Required</h2>
              <p>You need to sign in to access your account settings.</p>
              <button 
                // className="auth-required-btn"
                className="btn"
                onClick={() => setIsAuthModalOpen(true)}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>
        
        <AuthModal 
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          initialMode="login"
        />
      </>
    );
  }

  return (
    <div className="account-page">
      <div className="account-container">
        <div className="account-header">
          <h1>Account Settings</h1>
          <p>Manage your profile and account preferences</p>
        </div>

        <div className="account-sections">
          {/* Profile Section */}
          <div className="account-section">
            <div className="section-header">
              <h2>Profile Information</h2>
              {!editMode ? (
                <button 
                  // className="edit-btn"
                  className="btn"
                  onClick={() => setEditMode(true)}
                >
                  Edit
                </button>
              ) : (
                <div className="edit-actions">
                  <button 
                    // className="cancel-btn"
                    className="btn"
                    onClick={() => {
                      setEditMode(false);
                      setMessage('');
                      // Reset form data
                      setFormData({
                        first_name: user.first_name || '',
                        surname: user.surname || '',
                        display_name: user.display_name || '',
                        phone: user.phone || '',
                        country: user.country || '',
                        bio: user.bio || ''
                      });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {message && (
              <div className={`message ${message.includes('successfully') ? 'success' : 'error'}`}>
                {message}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="profile-form">
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    name="first_name"
                    value={formData.first_name}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Surname</label>
                  <input
                    type="text"
                    name="surname"
                    value={formData.surname}
                    onChange={handleInputChange}
                    disabled={!editMode}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Display Name (Optional)</label>
                <input
                  type="text"
                  name="display_name"
                  value={formData.display_name}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  placeholder="Leave empty to use first name + surname"
                />
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="disabled-field"
                />
                <small>Email cannot be changed. Contact support if needed.</small>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Phone</label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    disabled={!editMode}
                  />
                </div>
                <div className="form-group">
                  <label>Country</label>
                  <input
                    type="text"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    disabled={!editMode}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Bio</label>
                <textarea
                  name="bio"
                  value={formData.bio}
                  onChange={handleInputChange}
                  disabled={!editMode}
                  rows="3"
                  placeholder="Tell us a bit about yourself..."
                />
              </div>

              {editMode && (
                <button 
                  type="submit" 
                  // className="save-btn"
                  className="btn"
                  disabled={updating}
                >
                  {updating ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </form>
          </div>

          {/* Account Status */}
          <div className="account-section">
            <div className="section-header">
              <h2>Account Status</h2>
            </div>
            <div className="status-info">
              <div className="status-item">
                <span className="status-label">Account Status:</span>
                <span className={`status-value ${user.is_active ? 'active' : 'inactive'}`}>
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Email Verified:</span>
                <span className={`status-value ${user.is_verified ? 'verified' : 'unverified'}`}>
                  {user.is_verified ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Member Since:</span>
                <span className="status-value">
                  {new Date(user.createdAt).toLocaleDateString()}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Subscription:</span>
                <span className="status-value subscription">
                  {user.subscription?.plan?.charAt(0).toUpperCase() + 
                   user.subscription?.plan?.slice(1) || 'Free'} Plan
                </span>
              </div>
            </div>
            <div className="section-actions">
              <a href="/account/subscription" className="btn">
                Manage Subscription
              </a>
              <a href="/subscription/plans" className="btn">
                View Plans
              </a>
            </div>
          </div>

          {/* Team Preferences */}
          <div className="account-section">
            <div className="section-header">
              <h2>Team Preferences</h2>
              <a 
                href="/account/team-preferences"
                // className="edit-btn"
                className="btn"
              >
                Manage
              </a>
            </div>
            <div className="team-preferences">
              <div className="preference-item">
                <span className="preference-label">Favourite Team:</span>
                <span className="preference-value">
                  {user.favourite_team ? (
                    typeof user.favourite_team === 'object' ? 
                      user.favourite_team.name : 
                      (loadingTeamNames ? 'Loading...' : (teamNames[user.favourite_team] || `Team ${user.favourite_team}`))
                  ) : 'None selected'}
                </span>
              </div>
              <div className="preference-item">
                <span className="preference-label">Following:</span>
                <span className="preference-value">
                  {user.followed_teams?.length || 0} teams
                </span>
              </div>
            </div>
          </div>

          {/* Cookie Preferences */}
          <div className="account-section">
            <div className="section-header">
              <h2>Cookie Preferences</h2>
            </div>
            <CookieSettingsSection />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Account;