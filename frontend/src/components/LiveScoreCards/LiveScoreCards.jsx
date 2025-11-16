import React from "react";

import "./livescorecards.css";

// A small status badge component
const StatusBadge = ({ status }) => {
  const cls = `status-badge status-${status}`;
  const label = status === "live" ? "LIVE" : status === "finished" ? "FT" : "UPCOMING";
  return <span className={cls}>{label}</span>;
};

// Match shape:
// {
//   id, date, home_team, away_team, home_logo, away_logo,
//   status: 'live' | 'finished' | 'upcoming',
//   score: { home, away }
// }

const LiveScoreCards = ({ matches = [] }) => {
  // fallback sample data when no matches are provided
  const sampleMatches = [
    {
      id: "1",
      date: new Date().toISOString(),
      home_team: "West Ham United",
      away_team: "Southampton",
      home_logo: require("../../assets/images/WestHam-Logo.png"),
      away_logo: require("../../assets/images/Southampton-Logo.png"),
      status: "live",
      score: { home: 0, away: 2 },
    },
    {
      id: "2",
      date: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      home_team: "Arsenal",
      away_team: "Liverpool",
      home_logo: null,
      away_logo: null,
      status: "upcoming",
      score: { home: null, away: null },
    },
  ];

  // Normalize match team data to support either flat fields or nested team objects
  const normalizeMatch = (m) => {
    const home = m.home || { name: m.home_team, logo: m.home_logo };
    const away = m.away || { name: m.away_team, logo: m.away_logo };
    return {
      ...m,
      home_team: home.name,
      away_team: away.name,
      home_logo: home.logo,
      away_logo: away.logo,
    };
  };

  const list = matches && matches.length ? matches.map(normalizeMatch) : sampleMatches.map(normalizeMatch);

  return (
    <div>
      <div className="live-score-card-container">
        {list.map((m) => (
          <div key={m.id} className="live-score-card">
            <div className="live-score-card-header">
              <StatusBadge status={m.status} />
              <p>
                {m.home_team} vs {m.away_team}
              </p>
            </div>

            <div className="live-score-card-body">
              <div className="live-score-card-teams">
                {/* Home Team */}
                <div className="live-score-card-team">
                  <div className="live-score-card-team-info">
                    {m.home_logo && (
                      <img
                        className="live-score-card-logo"
                        src={m.home_logo}
                        alt={m.home_team}
                      />
                    )}
                    <p>{m.home_team}</p>
                  </div>
                  <p className="live-score-card-score-value">
                    {m.score?.home ?? "-"}
                  </p>
                </div>

                {/* VS divider */}
                <div className="live-score-vs">VS</div>

                {/* Away Team */}
                <div className="live-score-card-team">
                  <div className="live-score-card-team-info">
                    {m.away_logo && (
                      <img
                        className="live-score-card-logo"
                        src={m.away_logo}
                        alt={m.away_team}
                      />
                    )}
                    <p>{m.away_team}</p>
                  </div>
                  <p className="live-score-card-score-value">
                    {m.score?.away ?? "-"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LiveScoreCards;
