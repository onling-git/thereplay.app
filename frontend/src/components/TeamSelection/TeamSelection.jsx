// src/components/TeamSelection/TeamSelection.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, Heart, Plus, Check } from 'lucide-react';
import { getTeamCountries, getTeams } from '../../api.js';
import './TeamSelection.css';

const TeamSelection = ({ 
  isOpen, 
  onClose, 
  onSave, 
  initialFavorite = null,
  initialFollowed = [],
  mode = 'both' // 'favorite', 'followed', or 'both'
}) => {
  const [teams, setTeams] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [favoriteTeam, setFavoriteTeam] = useState(initialFavorite);
  const [followedTeams, setFollowedTeams] = useState(initialFollowed);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Load countries on mount
  useEffect(() => {
    if (isOpen) {
      loadCountries();
      loadTeams();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Reload teams when filters change
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
      loadTeams(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, selectedCountry]);

  const loadCountries = async () => {
    try {
      const response = await getTeamCountries();
      setCountries(response || []);
    } catch (error) {
      console.error('Failed to load countries:', error);
    }
  };

  const loadTeams = async (reset = false) => {
    if (loading) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: '50',
        offset: reset ? '0' : (currentPage * 50).toString(),
      });
      
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCountry) params.append('country_id', selectedCountry);
      
      const response = await getTeams({
        search: searchTerm,
        country_id: selectedCountry, // Fixed: changed from 'country' to 'country_id'
        page: reset ? 1 : currentPage + 1,
        limit: 20
      });
      const newTeams = response?.teams || [];
      
      if (reset) {
        setTeams(newTeams);
      } else {
        setTeams(prev => [...prev, ...newTeams]);
      }
      
      setHasMore(response?.pagination?.hasMore || false);
      if (!reset) {
        setCurrentPage(prev => prev + 1);
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFavoriteSelect = (team) => {
    if (favoriteTeam?.id === team.id) {
      setFavoriteTeam(null);
    } else {
      setFavoriteTeam(team);
    }
  };

  const handleFollowToggle = (team) => {
    setFollowedTeams(prev => {
      const isFollowed = prev.some(t => t.id === team.id);
      if (isFollowed) {
        return prev.filter(t => t.id !== team.id);
      } else {
        return [...prev, team];
      }
    });
  };

  const handleSave = () => {
    const data = {};
    
    if (mode === 'favorite' || mode === 'both') {
      data.favourite_team = favoriteTeam?.id || null;
      data.favourite_team_obj = favoriteTeam; // Pass full object
    }
    
    if (mode === 'followed' || mode === 'both') {
      data.followed_teams = followedTeams.map(t => t.id);
      data.followed_teams_objs = followedTeams; // Pass full objects
    }
    
    onSave(data);
  };

  const filteredTeams = useMemo(() => {
    return teams.filter(team => {
      const matchesSearch = !searchTerm || 
        team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.short_code?.toLowerCase().includes(searchTerm.toLowerCase());
      
      return matchesSearch;
    });
  }, [teams, searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="team-selection-overlay">
      <div className="team-selection-modal">
        <div className="team-selection-header">
          <h2>
            {mode === 'favorite' ? 'Select Your Favorite Team' :
             mode === 'followed' ? 'Select Teams to Follow' :
             'Select Your Teams'}
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="team-selection-filters">
          <div className="search-box">
            <Search size={20} />
            <input
              type="text"
              placeholder="Search teams..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            className="country-filter"
          >
            <option value="">All Countries</option>
            {countries.map(country => (
              <option key={country.id} value={country.id}>
                {country.name} ({country.team_count})
              </option>
            ))}
          </select>
        </div>

        <div className="team-content">
          <div className="team-list">
            {filteredTeams.map(team => (
            <div key={team.id} className="team-item">
              <div className="team-info">
                {team.image_path && (
                  <img 
                    src={team.image_path} 
                    alt={team.name}
                    className="team-logo"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <div className="team-details">
                  <h4>{team.name}</h4>
                  {team.short_code && (
                    <span className="team-code">{team.short_code}</span>
                  )}
                </div>
              </div>
              
              <div className="team-actions">
                {(mode === 'both' || mode === 'favorite') && (
                  <button
                    onClick={() => handleFavoriteSelect(team)}
                    className={`action-btn favorite ${favoriteTeam?.id === team.id ? 'selected' : ''}`}
                    title="Set as favorite"
                  >
                    <Heart size={16} />
                  </button>
                )}
                
                {(mode === 'both' || mode === 'followed') && (
                  <button
                    onClick={() => handleFollowToggle(team)}
                    className={`action-btn follow ${followedTeams.some(t => t.id === team.id) ? 'selected' : ''}`}
                    title={followedTeams.some(t => t.id === team.id) ? 'Unfollow' : 'Follow'}
                  >
                    {followedTeams.some(t => t.id === team.id) ? 
                      <Check size={16} /> : 
                      <Plus size={16} />
                    }
                  </button>
                )}
              </div>
            </div>
          ))}
          
          {hasMore && (
            <button 
              onClick={() => loadTeams(false)} 
              disabled={loading}
              className="load-more-btn"
            >
              {loading ? 'Loading...' : 'Load More Teams'}
            </button>
          )}
        </div>
      </div>

      {/* Selection Summary - Compact */}
        {(favoriteTeam || followedTeams.length > 0) && (
          <div className="selection-summary">
            <h4>Your Selection</h4>
            <div className="selection-content">
              {favoriteTeam && (
                <div className="selection-item">
                  <div className="selection-label">
                    <Heart size={12} />
                    <span>Favorite:</span>
                  </div>
                  <div className="selected-team">
                    {favoriteTeam.image_path && (
                      <img src={favoriteTeam.image_path} alt={favoriteTeam.name} className="mini-logo" />
                    )}
                    <span>{favoriteTeam.name}</span>
                    <button 
                      onClick={() => setFavoriteTeam(null)}
                      className="remove-btn"
                      title="Remove favorite"
                    >
                      <X size={12} />
                    </button>
                  </div>
                </div>
              )}
              
              {followedTeams.length > 0 && (
                <div className="selection-item">
                  <div className="selection-label">
                    <Plus size={12} />
                    <span>Following ({followedTeams.length}):</span>
                  </div>
                  <div className="followed-teams-list">
                    {followedTeams.slice(0, 2).map(team => (
                      <div key={team.id} className="selected-team">
                        {team.image_path && (
                          <img src={team.image_path} alt={team.name} className="mini-logo" />
                        )}
                        <span>{team.name}</span>
                        <button 
                          onClick={() => handleFollowToggle(team)}
                          className="remove-btn"
                          title="Unfollow"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {followedTeams.length > 2 && (
                      <div className="selected-team">
                        <span>+ {followedTeams.length - 2} more</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="team-selection-footer">
          <button onClick={onClose} className="cancel-btn">
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className="save-btn"
            disabled={!favoriteTeam && followedTeams.length === 0}
          >
            {(() => {
              if (!favoriteTeam && followedTeams.length === 0) {
                return mode === 'favorite' ? 'Select a Favorite Team' : mode === 'followed' ? 'Select Teams to Follow' : 'Make a Selection';
              }
              if (mode === 'favorite' && favoriteTeam) {
                return 'Save Favorite Team';
              }
              if (mode === 'followed' && followedTeams.length > 0) {
                return `Save ${followedTeams.length} Followed Team${followedTeams.length !== 1 ? 's' : ''}`;
              }
              if (favoriteTeam && followedTeams.length > 0) {
                return 'Save All Selections';
              }
              if (favoriteTeam) {
                return 'Save Favorite Team';
              }
              if (followedTeams.length > 0) {
                return `Save ${followedTeams.length} Followed Team${followedTeams.length !== 1 ? 's' : ''}`;
              }
              return 'Save Selection';
            })()} 
          </button>
        </div>
      </div>
    </div>
  );
};

export default TeamSelection;