// src/components/StandingsModal/StandingsModal.jsx
import React from 'react';
import { X } from 'lucide-react';
import './StandingsModal.css';

const StandingsModal = ({ isOpen, onClose, standings, currentTeamId }) => {
  if (!isOpen) return null;

  return (
    <div className="standings-modal-overlay" onClick={onClose}>
      <div className="standings-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="standings-modal-header">
          <h2>Full League Standings</h2>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={24} />
          </button>
        </div>
        
        <div className="standings-modal-body">
          {standings.map((standing) => (
            <div key={standing._id} className="modal-standings-table-container">
              <h3>{standing.league_name} - {standing.season_name}</h3>
              <div className="modal-table-wrapper">
                <table className="modal-standings-table">
                  <thead>
                    <tr>
                      <th>Pos</th>
                      <th>Team</th>
                      <th>P</th>
                      <th>W</th>
                      <th>D</th>
                      <th>L</th>
                      <th>GF</th>
                      <th>GA</th>
                      <th>GD</th>
                      <th>Pts</th>
                      <th>Form</th>
                    </tr>
                  </thead>
                  <tbody>
                    {standing.table && standing.table.map((entry) => (
                      <tr 
                        key={entry.participant_id}
                        className={entry.participant_id === currentTeamId ? 'current-team' : ''}
                      >
                        <td>{entry.position}</td>
                        <td className="team-name-cell">
                          {entry.team_image && (
                            <img 
                              src={entry.team_image} 
                              alt={entry.team_name} 
                              className="team-logo-small"
                            />
                          )}
                          <span>{entry.team_name || `Team #${entry.participant_id}`}</span>
                        </td>
                        <td>{entry.played}</td>
                        <td>{entry.won}</td>
                        <td>{entry.drawn}</td>
                        <td>{entry.lost}</td>
                        <td>{entry.goals_for}</td>
                        <td>{entry.goals_against}</td>
                        <td>{entry.goal_difference > 0 ? '+' : ''}{entry.goal_difference}</td>
                        <td><strong>{entry.points}</strong></td>
                        <td className="form-cell">
                          {entry.form && entry.form.map((result, idx) => (
                            <span 
                              key={idx} 
                              className={`form-badge form-${result.toLowerCase()}`}
                            >
                              {result}
                            </span>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StandingsModal;
