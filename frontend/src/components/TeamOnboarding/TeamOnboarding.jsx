// src/components/TeamOnboarding/TeamOnboarding.jsx
import React, { useState, useEffect } from 'react';
import { Heart, Plus, ArrowRight } from 'lucide-react';
import TeamSelection from '../TeamSelection/TeamSelection';
import { useAuth } from '../../contexts/AuthContext';
import * as authAPI from '../../api/auth.js';
import { getTeams } from '../../api.js';
import './TeamOnboarding.css';

const TeamOnboarding = ({ 
  isOpen, 
  onComplete, 
  onSkip,
  isNewUser = false,
  initialFavoriteId = null,    // Add these props to pass existing preferences
  initialFollowedIds = []       // from parent component
}) => {
  const { isAuthenticated } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [favoriteTeam, setFavoriteTeam] = useState(null);
  const [followedTeams, setFollowedTeams] = useState([]);
  const [showTeamSelection, setShowTeamSelection] = useState(false);
  const [selectionMode, setSelectionMode] = useState('favorite');
  const [saving, setSaving] = useState(false);

  // Load existing team details when component opens
  useEffect(() => {
    const loadExistingTeamDetails = async () => {
      console.log('🔍 TeamOnboarding: Loading existing team details:', {
        initialFavoriteId,
        initialFollowedIds,
        isOpen,
        currentFavoriteTeam: favoriteTeam,
        currentFollowedTeams: followedTeams
      });
      
      if (!isOpen) return;
      
      // Load favorite team details if we have an ID
      if (initialFavoriteId && !favoriteTeam) {
        console.log('🔍 TeamOnboarding: Loading favorite team details for ID:', initialFavoriteId);
        const favoriteDetails = await fetchTeamsByIds([initialFavoriteId]);
        const favoriteTeamData = favoriteDetails[0] || { id: initialFavoriteId, name: `Team ${initialFavoriteId}` };
        console.log('🔍 TeamOnboarding: Setting favorite team data:', favoriteTeamData);
        setFavoriteTeam(favoriteTeamData);
      }
      
      // Load followed teams details if we have IDs
      if (initialFollowedIds.length > 0 && followedTeams.length === 0) {
        console.log('🔍 TeamOnboarding: Loading followed teams details for IDs:', initialFollowedIds);
        const followedDetails = await fetchTeamsByIds(initialFollowedIds);
        const followedTeamsData = initialFollowedIds.map(id => {
          const foundTeam = followedDetails.find(team => team.id === id);
          return foundTeam || { id, name: `Team ${id}` };
        });
        console.log('🔍 TeamOnboarding: Setting followed teams data:', followedTeamsData);
        setFollowedTeams(followedTeamsData);
      }
    };
    
    loadExistingTeamDetails();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialFavoriteId, initialFollowedIds]);

  const openTeamSelection = (mode) => {
    setSelectionMode(mode);
    setShowTeamSelection(true);
  };

  // Helper function to fetch team details by IDs
  const fetchTeamsByIds = async (teamIds) => {
    if (!teamIds || teamIds.length === 0) return [];
    
    console.log('🔍 fetchTeamsByIds called with:', teamIds);
    
    try {
      // The API might support filtering by IDs - let's try getting all teams and filtering
      const teamsResponse = await getTeams();
      console.log('🔍 getTeams response:', teamsResponse);
      
      const allTeams = teamsResponse?.teams || teamsResponse || [];
      console.log('🔍 All teams count:', allTeams.length);
      console.log('🔍 First few teams:', allTeams.slice(0, 3));
      
      // Filter teams by the IDs we need
      const foundTeams = teamIds.map(id => {
        const team = allTeams.find(team => team.id === id);
        console.log(`🔍 Looking for team ID ${id}, found:`, team);
        return team;
      }).filter(Boolean);
      
      console.log('🔍 Found teams:', foundTeams);
      return foundTeams;
    } catch (error) {
      console.error('❌ Error fetching team details:', error);
      // Fallback to just return objects with IDs
      return teamIds.map(id => ({ id, name: `Team ${id}` })); // Add fallback name
    }
  };

  const handleTeamSelection = async (data) => {
    console.log('🔍 handleTeamSelection called with:', data);
    
    if (data.favourite_team !== undefined) {
      // Find the team object for the selected favorite
      const favoriteId = data.favourite_team;
      console.log('🔍 Processing favorite team ID:', favoriteId);
      
      if (favoriteId && currentStep === 1) {
        // Fetch the actual team details
        console.log('🔍 Fetching team details for favorite team...');
        const teamDetails = await fetchTeamsByIds([favoriteId]);
        console.log('🔍 Received team details for favorite:', teamDetails);
        
        const selectedTeam = teamDetails[0] || { id: favoriteId, name: `Team ${favoriteId}` };
        console.log('🔍 Setting favorite team to:', selectedTeam);
        setFavoriteTeam(selectedTeam);
      }
    }
    
    if (data.followed_teams !== undefined) {
      console.log('🔍 Processing followed teams IDs:', data.followed_teams);
      
      // Fetch the actual team details for followed teams
      console.log('🔍 Fetching team details for followed teams...');
      const teamDetails = await fetchTeamsByIds(data.followed_teams);
      console.log('🔍 Received team details for followed teams:', teamDetails);
      
      // Add fallback names for teams that weren't found
      const teamsWithFallback = data.followed_teams.map(id => {
        const foundTeam = teamDetails.find(team => team.id === id);
        return foundTeam || { id, name: `Team ${id}` };
      });
      console.log('🔍 Setting followed teams to:', teamsWithFallback);
      setFollowedTeams(teamsWithFallback);
    }
    
    setShowTeamSelection(false);
    
    // Move to next step if we were selecting favorite team
    if (selectionMode === 'favorite' && currentStep === 1) {
      setCurrentStep(2);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const preferences = {
        favourite_team: favoriteTeam?.id || null,
        followed_teams: followedTeams.map(t => t.id)
      };
      
      console.log('🔄 Saving team preferences:', {
        isAuthenticated,
        preferences,
        favoriteTeam,
        followedTeams
      });
      
      // Use different API based on authentication status
      if (isAuthenticated) {
        console.log('👤 User is authenticated, using updateTeamPreferences');
        const result = await authAPI.updateTeamPreferences(preferences);
        console.log('✅ updateTeamPreferences success:', result);
      } else {
        console.log('👻 User is anonymous, using setAnonymousTeamPreferences');
        const result = await authAPI.setAnonymousTeamPreferences(preferences);
        console.log('✅ setAnonymousTeamPreferences success:', result);
      }
      
      onComplete(preferences);
    } catch (error) {
      console.error('❌ Failed to save team preferences - Full error:', error);
      console.error('❌ Error status:', error.status);
      console.error('❌ Error body:', error.body);
      console.error('❌ Error message:', error.message);
      
      // Show more specific error message
      let errorMessage = 'Failed to save preferences. Please try again.';
      if (error.status === 401) {
        errorMessage = 'Session expired. Please log in and try again.';
      } else if (error.status === 400) {
        errorMessage = 'Invalid team selection. Please try again.';
      } else if (error.status === 404) {
        errorMessage = 'Server endpoint not found. Please contact support.';
      } else if (error.status === 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (error.body && error.body.message) {
        errorMessage = error.body.message;
      }
      
      alert(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1 && !favoriteTeam) {
      openTeamSelection('favorite');
    } else if (currentStep === 1 && favoriteTeam) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      handleSave();
    }
  };

  const handleSkipStep = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else {
      handleSave(); // Save whatever we have
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="team-onboarding-overlay">
        <div className="team-onboarding-modal">
          <div className="onboarding-header">
            <div className="step-indicator">
              <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>1</div>
              <div className="step-line"></div>
              <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>2</div>
            </div>
            <h1>
              {isNewUser ? 'Welcome to The Final Play!' : 'Set Up Your Team Preferences'}
            </h1>
            <p className="onboarding-subtitle">
              {currentStep === 1 ? 
                'First, choose your favorite team to get personalized content' :
                'Now, select additional teams you\'d like to follow for news and updates'
              }
            </p>
          </div>

          <div className="onboarding-content">
            {currentStep === 1 && (
              <div className="onboarding-step">
                <div className="step-icon favorite">
                  <Heart size={48} />
                </div>
                <h2>Choose Your Favorite Team</h2>
                <p>
                  Your favorite team will appear on your home screen and you'll get 
                  priority updates about their matches, news, and performance.
                </p>
                
                {favoriteTeam ? (
                  <div className="selected-team">
                    <div className="selection-display favorite">
                      <Heart size={20} className="selection-icon" />
                      <span>{favoriteTeam?.name || 'Favorite Team Selected'}</span>
                    </div>
                    <button 
                      onClick={() => openTeamSelection('favorite')}
                      className="change-selection-btn"
                    >
                      Change Selection
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => openTeamSelection('favorite')}
                    className="select-team-btn favorite"
                  >
                    <Heart size={20} />
                    Select Your Favorite Team
                  </button>
                )}
              </div>
            )}

            {currentStep === 2 && (
              <div className="onboarding-step">
                <div className="step-icon followed">
                  <Plus size={48} />
                </div>
                <h2>Follow Additional Teams</h2>
                <p>
                  Stay updated with multiple teams! You'll receive news and updates 
                  for all teams you follow, but your favorite gets priority.
                </p>
                
                <div className="current-selections">
                  {favoriteTeam && (
                    <div className="selection-display favorite">
                      <Heart size={16} className="selection-icon" />
                      <span>Favorite: {favoriteTeam?.name || 'Team Selected'}</span>
                    </div>
                  )}
                  
                  {followedTeams.length > 0 && (
                    <div className="selection-display followed">
                      <Plus size={16} className="selection-icon" />
                      <span>Following: {followedTeams.length} teams</span>
                      {followedTeams.length <= 3 && (
                        <div className="team-names">
                          {followedTeams.map(team => team?.name).filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => openTeamSelection('followed')}
                  className="select-team-btn followed"
                >
                  <Plus size={20} />
                  {followedTeams.length > 0 ? 'Manage Followed Teams' : 'Select Teams to Follow'}
                </button>
              </div>
            )}
          </div>

          <div className="onboarding-footer">
            <div className="footer-actions">
              <button 
                onClick={currentStep === 1 ? onSkip : handleSkipStep}
                className="skip-btn"
              >
                {currentStep === 1 ? 'Skip Setup' : 'Skip This Step'}
              </button>
              
              <div className="next-actions">
                <button 
                  onClick={handleNext}
                  disabled={saving}
                  className="next-btn"
                >
                  {saving ? 'Saving...' : (
                    currentStep === 1 ? (
                      favoriteTeam ? (
                        <>
                          Next <ArrowRight size={16} />
                        </>
                      ) : (
                        'Select Favorite Team'
                      )
                    ) : (
                      'Complete Setup'
                    )
                  )}
                </button>
              </div>
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

export default TeamOnboarding;