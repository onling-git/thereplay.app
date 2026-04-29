// src/components/StandingsPositionCard/StandingsPositionCard.jsx
import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import './StandingsPositionCard.css';

const StandingsPositionCard = ({ standings, teamId, teamName, teamImage, onViewTable }) => {
  if (!standings || standings.length === 0) {
    return null;
  }

  // Find the team's position in the primary standings (first one, typically league)
  const primaryStanding = standings[0];
  const teamEntry = primaryStanding?.table?.find(
    entry => entry.participant_id === teamId
  );

  if (!teamEntry) {
    return null;
  }

  // Get the table snippet: team above and below (or 2 above/below at edges)
  const getTableSnippet = () => {
    const table = primaryStanding.table;
    const currentIndex = table.findIndex(entry => entry.participant_id === teamId);
    
    if (currentIndex === -1) return [];

    // Handle edge cases
    if (currentIndex === 0) {
      // Team is at the top, show current and 2 below
      return table.slice(0, Math.min(3, table.length));
    } else if (currentIndex === table.length - 1) {
      // Team is at the bottom, show 2 above and current
      return table.slice(Math.max(0, currentIndex - 2), currentIndex + 1);
    } else {
      // Normal case: 1 above, current, and 1 below
      return table.slice(currentIndex - 1, Math.min(currentIndex + 2, table.length));
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up':
        return <ArrowUp className="trend-icon trend-up" size={20} />;
      case 'down':
        return <ArrowDown className="trend-icon trend-down" size={20} />;
      default:
        return <Minus className="trend-icon trend-equal" size={20} />;
    }
  };

  const getPositionSuffix = (position) => {
    if (position === 1) return 'st';
    if (position === 2) return 'nd';
    if (position === 3) return 'rd';
    return 'th';
  };

  const tableSnippet = getTableSnippet();

  return (
    <div className="standings-position-card">
      <div className="card-content">
        {teamImage && (
          <img 
            src={teamImage} 
            alt={teamName} 
            className="team-badge"
          />
        )}
        
        <div className="position-info">
          <div className="position-number">
            {teamEntry.position}
            <sup>{getPositionSuffix(teamEntry.position)}</sup>
          </div>
          <div className="league-name">{primaryStanding.league_name}</div>
          
          {/* Form Display */}
          {teamEntry.form && teamEntry.form.length > 0 && (
            <div className="form-display">
              {teamEntry.form.slice(-5).map((result, idx) => (
                <span 
                  key={idx} 
                  className={`form-badge form-${result.toLowerCase()}`}
                  title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
                >
                  {result}
                </span>
              ))}
            </div>
          )}
        </div>
        
        <div className="trend-indicator">
          {getTrendIcon(teamEntry.trend)}
        </div>
      </div>

      {/* Table Snippet */}
      <div className="standings-snippet">
        <table className="snippet-table">
          <thead>
            <tr>
              <th>Pos</th>
              <th>Team</th>
              <th>P</th>
              <th>GD</th>
              <th>Pts</th>
            </tr>
          </thead>
          <tbody>
            {tableSnippet.map((entry) => (
              <tr 
                key={entry.participant_id}
                className={entry.participant_id === teamId ? 'current-team' : ''}
              >
                <td>{entry.position}</td>
                <td className="team-name-cell">
                  {entry.team_image && (
                    <img 
                      src={entry.team_image} 
                      alt={entry.team_name} 
                      className="team-logo-tiny"
                    />
                  )}
                  <span className="team-name-short">{entry.team_name || `Team #${entry.participant_id}`}</span>
                </td>
                <td>{entry.played}</td>
                <td>{entry.goal_difference > 0 ? '+' : ''}{entry.goal_difference}</td>
                <td><strong>{entry.points}</strong></td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* View Full Table Button */}
        <button className="view-table-btn" onClick={onViewTable}>
          View Full Table
        </button>
      </div>
    </div>
  );
};

export default StandingsPositionCard;
