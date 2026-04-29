// src/components/CompetitionsCard/CompetitionsCard.jsx
import React from 'react';
import { Trophy } from 'lucide-react';
import './CompetitionsCard.css';

const CompetitionsCard = ({ competitions, teamName }) => {
  if (!competitions || competitions.length === 0) {
    return null;
  }

  // Filter only competitions where team is still participating
  const activeCompetitions = competitions.filter(comp => comp.is_still_participating);

  if (activeCompetitions.length === 0) {
    return null;
  }

  return (
    <div className="competitions-card">
      {activeCompetitions.map((competition, index) => (
        <div key={`${competition.competition_id}-${index}`} className="competition-item">
          <div className="competition-header">
            {competition.competition_image && (
              <img 
                src={competition.competition_image} 
                alt={competition.competition_name} 
                className="competition-badge"
              />
            )}
            {!competition.competition_image && (
              <Trophy className="competition-icon" size={32} />
            )}
          </div>
          
          <div className="competition-details">
            <div className="competition-name">{competition.competition_name}</div>
            <div className="competition-stage">{competition.current_stage}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CompetitionsCard;
