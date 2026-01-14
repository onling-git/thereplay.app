// src/components/Favorites/FavoriteMatchCard.jsx
import React, { useState } from 'react';
import { removeFavoriteMatch } from '../../api/favorites';
import { formatDate, formatTime } from '../../utils/dateUtils';
import './FavoriteMatchCard.css';

const FavoriteMatchCard = ({ match, onMatchRemoved }) => {
  const [removing, setRemoving] = useState(false);

  const handleRemoveFavorite = async (e) => {
    e.stopPropagation();
    
    if (removing) return;
    
    try {
      setRemoving(true);
      await removeFavoriteMatch(match.match_id);
      onMatchRemoved(match.match_id);
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      // Could add a toast notification here
    } finally {
      setRemoving(false);
    }
  };

  const handleCardClick = () => {
    // Navigate to match details page
    const homeSlug = match.match_info?.home_team?.team_slug || 'unknown';
    const awaySlug = match.match_info?.away_team?.team_slug || 'unknown';
    window.location.href = `/match/${match.match_id}?teams=${homeSlug}-vs-${awaySlug}`;
  };

  const getSourceIcon = (source) => {
    switch (source) {
      case 'auto_favorite_team':
        return '⭐';
      case 'auto_followed_team':
        return '👁️';
      default:
        return '💙';
    }
  };

  const getSourceLabel = (source) => {
    switch (source) {
      case 'auto_favorite_team':
        return 'Favorite Team';
      case 'auto_followed_team':
        return 'Followed Team';
      default:
        return 'Manually Added';
    }
  };

  const matchDate = new Date(match.match_info.starting_at);
  const isUpcoming = matchDate > new Date();

  return (
    <div className="favorite-match-card" onClick={handleCardClick}>
      <div className="match-card-header">
        <div className="match-source">
          <span className="source-icon">{getSourceIcon(match.source)}</span>
          <span className="source-label">{getSourceLabel(match.source)}</span>
        </div>
        
        <button 
          className={`remove-favorite-btn ${removing ? 'removing' : ''}`}
          onClick={handleRemoveFavorite}
          disabled={removing}
          title="Remove from favorites"
        >
          {removing ? '⏳' : '❌'}
        </button>
      </div>

      <div className="match-teams">
        <div className="team home-team">
          <span className="team-name">{match.match_info.home_team.team_name}</span>
        </div>
        
        <div className="vs-divider">
          <span>vs</span>
        </div>
        
        <div className="team away-team">
          <span className="team-name">{match.match_info.away_team.team_name}</span>
        </div>
      </div>

      <div className="match-details">
        <div className="match-date-time">
          <span className="match-date">{formatDate(matchDate)}</span>
          <span className="match-time">{formatTime(matchDate)}</span>
        </div>
        
        {match.match_info.league?.name && (
          <div className="match-league">
            {match.match_info.league.name}
          </div>
        )}
        
        {match.match_info.venue?.name && (
          <div className="match-venue">
            📍 {match.match_info.venue.name}
            {match.match_info.venue.city_name && `, ${match.match_info.venue.city_name}`}
          </div>
        )}
      </div>

      <div className="match-status">
        <span className={`status-badge ${isUpcoming ? 'upcoming' : 'past'}`}>
          {isUpcoming ? 'Upcoming' : 'Finished'}
        </span>
        
        <div className="expires-info">
          <span>Expires: {formatDate(new Date(match.expires_at))}</span>
        </div>
      </div>
    </div>
  );
};

export default FavoriteMatchCard;