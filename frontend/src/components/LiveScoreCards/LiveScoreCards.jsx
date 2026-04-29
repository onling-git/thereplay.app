import React from "react";
import { Link } from "react-router-dom";
import FavoriteButton from "../Favorites/FavoriteButton";

import "./livescorecards.css";

// Helper function to generate team slug from team name
const slugify = (str) => {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

const LiveScoreCards = ({ matches }) => {
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
      home_team_slug: home.team_slug || m.home_team_slug || slugify(home.name || home.team_name),
      away_team_slug: away.team_slug || m.away_team_slug || slugify(away.name || away.team_name),
      minute: m.minute || m.match_info?.minute || null,
    };
  };

  console.log(matches);
  

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
    // Get user's timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    // Priority 1: Use starting_at_timestamp if available (guaranteed UTC)
    let matchDate;
    if (match.match_info?.starting_at_timestamp && Number.isFinite(match.match_info.starting_at_timestamp)) {
      // SportMonks timestamp is in seconds, JavaScript needs milliseconds
      matchDate = new Date(match.match_info.starting_at_timestamp * 1000);
    } else if (match.match_info?.starting_at) {
      // Priority 2: Use match_info.starting_at (better than match.date)
      matchDate = new Date(match.match_info.starting_at);
    } else {
      // Priority 3: Fallback to match.date (problematic local times)
      matchDate = new Date(match.date);
      console.warn('⚠️ Using match.date for timezone conversion - may be inaccurate for non-UK matches');
    }
    
    // Convert to user's local timezone
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: userTimezone
    }).format(matchDate);
  };

  console.log("normalize match: ", list);
  console.log("Raw matches before normalization:", matches);

  return (
    <div>

      <div>
        {list.map((m) => {
          console.log("Individual match data:", m);
          console.log("Match status:", m.status, "Minute:", m.minute, "Match status raw:", m.match_status);
          return (
          <div key={m.id} className="scorecard">
            <div className="scorecard-status">
              {m.status === "upcoming" && <span>{startTime(m)}</span>}
              {m.status === "live" && (
                <>
                  {m.minute && <span>{m.minute}'</span>}
                  <span>LIVE</span>
                </>
              )}
              {m.status === "finished" && <span>FT</span>}
            </div>
            <div className="scorecard-inner">
              <div className="scorecard-teams ">
                <div>
                  {m.home_logo && (
                    <img className="" src={m.home_logo} alt={`${m.home_team} badge`} />
                  )}
                  <Link to={`/${m.home_team_slug}/match/${m.id}/live`} className="team-name-link">
                    <p>{m.home_team}</p>
                  </Link>
                </div>
                <div>
                  {m.away_logo && (
                    <img className="" src={m.away_logo} alt={`${m.away_team} badge`} />
                  )}
                  <Link to={`/${m.away_team_slug}/match/${m.id}/live`} className="team-name-link">
                    <p>{m.away_team}</p>
                  </Link>
                </div>
              </div>
              <div className="scorecard-icon">
                <div>
                  <p className="scorecard-score">{m.score.home}</p>
                  <p className="scorecard-score">{m.score.away}</p>
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

export default LiveScoreCards;
