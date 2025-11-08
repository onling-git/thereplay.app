// src/components/TeamMatchSummary/TeamMatchSummary.jsx
import React from 'react';
import { useCurrentMatches } from '../../hooks/useTeamMatchInfo';
import './TeamMatchSummary.css';

/**
 * Compact component showing last and next match for a team
 * Useful for dashboards, team lists, etc.
 */
const TeamMatchSummary = ({ teamSlug, teamName, showTitle = true }) => {
  const { lastMatch, nextMatch, loading, error } = useCurrentMatches(teamSlug);

  if (loading) {
    return (
      <div className="team-match-summary loading">
        <p>Loading matches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="team-match-summary error">
        <p>Failed to load matches</p>
      </div>
    );
  }

  return (
    <div className="team-match-summary">
      {showTitle && <h4 className="summary-title">Recent Activity</h4>}
      
      <div className="summary-matches">
        {lastMatch && (
          <div className="summary-match last">
            <span className="match-label">Last:</span>
            <span className="opponent">{lastMatch.opponent_name}</span>
            <span className={`result ${lastMatch.win === true ? 'win' : lastMatch.win === false ? 'loss' : 'draw'}`}>
              {lastMatch.win === true ? 'W' : lastMatch.win === false ? 'L' : 'D'}
            </span>
            <span className="score">
              {lastMatch.home_game 
                ? `${lastMatch.goals_for}-${lastMatch.goals_against}`
                : `${lastMatch.goals_against}-${lastMatch.goals_for}`
              }
            </span>
          </div>
        )}

        {nextMatch && (
          <div className="summary-match next">
            <span className="match-label">Next:</span>
            <span className="opponent">{nextMatch.opponent_name}</span>
            <span className="date">
              {new Date(nextMatch.date).toLocaleDateString()}
            </span>
            <span className={`venue ${nextMatch.home_game ? 'home' : 'away'}`}>
              {nextMatch.home_game ? 'H' : 'A'}
            </span>
          </div>
        )}

        {!lastMatch && !nextMatch && (
          <div className="no-matches">
            No recent or upcoming matches
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamMatchSummary;