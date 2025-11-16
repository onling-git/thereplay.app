import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getLeagues } from "../../api";

import epllogo from "../../assets/images/epl-logo.svg";
import bundesligalogo from "../../assets/images/bundesliga-logo.svg";
import laligalogo from "../../assets/images/laliga-logo.svg";

import "./topleagues.css";

const TopLeagues = () => {
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);

  // Pre-defined league data with logos and IDs
  const leagueLogos = {
    39: { logo: epllogo, name: "Premier League" },    // Premier League
    140: { logo: laligalogo, name: "La Liga" },       // La Liga
    78: { logo: bundesligalogo, name: "Bundesliga" }, // Bundesliga
    135: { logo: bundesligalogo, name: "Serie A" },   // Serie A (using bundesliga logo as placeholder)
    61: { logo: bundesligalogo, name: "Ligue 1" },    // Ligue 1 (using bundesliga logo as placeholder)
  };

  useEffect(() => {
    const loadLeagues = async () => {
      try {
        const leaguesData = await getLeagues();
        setLeagues(leaguesData);
      } catch (error) {
        console.error('Error loading leagues:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLeagues();
  }, []);

  // Filter and sort leagues to show top ones first
  const getDisplayLeagues = () => {
    if (loading || leagues.length === 0) {
      // Show default leagues while loading
      return [
        { id: 39, name: "Premier League" },
        { id: 140, name: "La Liga" },
        { id: 78, name: "Bundesliga" },
        { id: 135, name: "Serie A" },
        { id: 61, name: "Ligue 1" },
      ];
    }

    // Priority order for top leagues
    const topLeagueIds = [39, 140, 78, 135, 61];
    
    // Get top leagues first, then others
    const topLeagues = topLeagueIds
      .map(id => leagues.find(league => league.id === id))
      .filter(Boolean);
    
    const otherLeagues = leagues
      .filter(league => !topLeagueIds.includes(league.id))
      .slice(0, Math.max(0, 6 - topLeagues.length));
    
    return [...topLeagues, ...otherLeagues].slice(0, 6);
  };

  const displayLeagues = getDisplayLeagues();

  return (
    <div>
      <div>
        <h2>Top Leagues</h2>
      </div>
      <div className="league-card-container">
        {displayLeagues.map((league) => {
          const leagueInfo = leagueLogos[league.id];
          const logo = leagueInfo?.logo || bundesligalogo; // fallback logo
          const displayName = leagueInfo?.name || league.name;
          
          return (
            <Link 
              key={league.id} 
              to={`/league/${league.id}/fixtures`}
              className="league-card-link"
            >
              <div className="league-card">
                <p>{displayName}</p>
                <img className="league-card-logo" src={logo} alt={displayName} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default TopLeagues;