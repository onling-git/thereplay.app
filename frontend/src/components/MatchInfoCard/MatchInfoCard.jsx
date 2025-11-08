// src/components/MatchInfoCard/MatchInfoCard.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import './MatchInfoCard.css';

const MatchInfoCard = ({ 
  matchInfo, 
  teamName, 
  teamSlug, 
  type = 'last', // 'last' or 'next'
  showLinks = true,
  className = '' 
}) => {
  if (!matchInfo) {
    return (
      <div className={`match-info-card empty ${className}`}>
        <p>No {type === 'last' ? 'recent' : 'upcoming'} match data available.</p>
      </div>
    );
  }

  const isLastMatch = type === 'last';
  const isLive = matchInfo.is_live || ['live', '1H', '2H', 'HT'].includes(matchInfo.status?.state);
  const matchDate = new Date(matchInfo.date);
  const now = new Date();
  const isToday = matchDate.toDateString() === now.toDateString();
  const isTomorrow = matchDate.toDateString() === new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();
  
  // Format date display
  let dateDisplay;
  if (isLive) {
    dateDisplay = `LIVE ${matchInfo.match_info?.minute ? `${matchInfo.match_info.minute}'` : ''}`;
  } else if (isToday) {
    dateDisplay = `Today at ${matchDate.toLocaleTimeString()}`;
  } else if (isTomorrow && !isLastMatch) {
    dateDisplay = `Tomorrow at ${matchDate.toLocaleTimeString()}`;
  } else {
    dateDisplay = `${matchDate.toLocaleDateString()} at ${matchDate.toLocaleTimeString()}`;
  }

  return (
    <div className={`match-info-card ${type} ${isLive ? 'live' : ''} ${className}`}>
      <div className="match-date">
        {dateDisplay}
        {isLive && (
          <span className="live-indicator">
            {matchInfo.status?.short_name || 'LIVE'}
          </span>
        )}
      </div>
      
      <div className="match-teams">
        {matchInfo.home_game ? teamName : matchInfo.opponent_name}
        {isLastMatch || isLive ? (
          <span className="to-score">
            {isLive ? (
              // Live match - show current score
              matchInfo.home_game 
                ? `${matchInfo.score?.home || 0} - ${matchInfo.score?.away || 0}`
                : `${matchInfo.score?.away || 0} - ${matchInfo.score?.home || 0}`
            ) : (
              // Last match - show final score
              matchInfo.home_game 
                ? `${matchInfo.goals_for} - ${matchInfo.goals_against}`
                : `${matchInfo.goals_against} - ${matchInfo.goals_for}`
            )}
          </span>
        ) : (
          <span className="vs"> vs </span>
        )}
        {matchInfo.home_game ? matchInfo.opponent_name : teamName}
      </div>
      
      <div className="match-details">
        {isLastMatch && (
          <span className="result">
            {matchInfo.win === true && <span className="win">🏆 Win</span>}
            {matchInfo.win === false && <span className="loss">😞 Loss</span>}
            {matchInfo.win === null && <span className="draw">🤝 Draw</span>}
            <span className="separator"> • </span>
          </span>
        )}
        <span className={`venue ${matchInfo.home_game ? 'home' : 'away'}`}>
          {matchInfo.home_game ? '🏠 Home' : '✈️ Away'}
        </span>
      </div>

      {showLinks && matchInfo.match_id && (
        <div className="match-links">
          <Link to={`/${teamSlug}/match/${matchInfo.match_id}/live`}>
            Live updates
          </Link>
          {isLastMatch && (
            <>
              <span className="separator"> • </span>
              <Link to={`/${teamSlug}/match/${matchInfo.match_id}/report`}>
                Match report
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default MatchInfoCard;