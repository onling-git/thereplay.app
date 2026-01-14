import React from "react";
import FavoriteButton from "../Favorites/FavoriteButton";

import "./homelivescorecards.css";




// A small status badge component
const StatusBadge = ({ status }) => {
  const cls = `status-badge status-${status}`;
  const label =
    status === "live" ? "LIVE" : status === "finished" ? "FT" : "UPCOMING";
  return <span className={cls}>{label}</span>;
};

const HomeLiveScoreCards = ({ matches = [] }) => {
  // Normalize match team data to support either flat fields or nested team objects
  const normalizeMatch = (m) => {
    const home = m.home || m.teams?.home || { name: m.home_team, logo: m.home_logo };
    const away = m.away || m.teams?.away || { name: m.away_team, logo: m.away_logo };
    return {
      ...m,
      home_team: home.name || home.team_name,
      away_team: away.name || away.team_name,
      home_logo: home.logo,
      away_logo: away.logo,
      minute: m.minute || m.match_info?.minute || null,
    };
  };

  // Only use actual matches, no fallback data
  const list = matches && matches.length ? matches.map(normalizeMatch) : [];

  // If no matches, show "No matches today" message
  if (list.length === 0) {
    return (
      <div className="no-matches-message">
        <p>No matches today</p>
      </div>
    );
  }

  const startTime = (match) => {
    // Priority 1: Use starting_at_timestamp if available (guaranteed UTC)
    let matchDate;
    if (match.match_info?.starting_at_timestamp && Number.isFinite(match.match_info.starting_at_timestamp)) {
      matchDate = new Date(match.match_info.starting_at_timestamp * 1000);
    } else if (match.match_info?.starting_at) {
      matchDate = new Date(match.match_info.starting_at);
    } else {
      matchDate = new Date(match.date);
      console.warn('⚠️ Using match.date for timezone - may be inaccurate for non-UK matches');
    }
    
    return matchDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  console.log("normalize match: ", list);
  console.log("Raw matches before normalization:", matches);

  return (
    <div>

      <div>
        {list.map((m) => {
          console.log("Individual match data:", m);
          return (
          <div key={m.id} className="home-scorecard">
            <div className="home-scorecard-status">
              <p>{m.status === "upcoming" ? startTime(m) : ""}</p>
              <p>{m.status === "live" ? (m.minute ? `${m.minute}'` : "") : ""}</p>
              <p>{m.status === "live" ? "LIVE" : m.status === "finished" ? "FT" : ""}</p>
            </div>
            <div className="home-scorecard-inner">
              <div className="home-scorecard-teams ">
                <div>
                  {m.home_logo && (
                    <img className="" src={m.home_logo} alt={m.home_team} />
                  )}
                  <p>{m.home_team}</p>
                </div>
                <div>
                  {m.away_logo && (
                    <img className="" src={m.away_logo} alt={m.away_team} />
                  )}
                  <p>{m.away_team}</p>
                </div>
              </div>
              <div className="home-scorecard-icon">
                <div>
                  <p className="home-scorecard-score">{m.score.home}</p>
                  <p className="home-scorecard-score">{m.score.away}</p>
                </div>
                {m.id && (
                  <FavoriteButton 
                    matchId={m.id} 
                    size="small"
                    onToggle={(isFavorited, action) => {
                      console.log(`Match ${action} ${isFavorited ? 'to' : 'from'} favorites`);
                    }}
                  />
                )}
              </div>
            </div>
          </div>
        )})}
      </div>
    </div>
  );
};

export default HomeLiveScoreCards;
