// Test component with mock data for formation display
// You can use this to test the frontend without needing real match data

import React, { useState } from 'react';
import './css/matchLive.css';

const FormationTestComponent = () => {
  const [activeTab, setActiveTab] = useState("lineups");
  
  // Mock lineup data to test the formation display
  const mockMatchSnapshot = {
    teams: {
      home: { team_name: "Test United" },
      away: { team_name: "Mock City" }
    },
    lineup: {
      home: [
        {
          player_id: 1,
          player_name: "John Goalkeeper",
          jersey_number: 1,
          position_id: 1,
          position_name: "Goalkeeper",
          image_path: null, // Will show initials
          rating: 7.2
        },
        {
          player_id: 2,
          player_name: "Mike Defender",
          jersey_number: 4,
          position_id: 3,
          position_name: "Centre-Back",
          image_path: "https://via.placeholder.com/60x60?text=MD", // Mock image
          rating: 6.8
        },
        {
          player_id: 3,
          player_name: "Sarah Midfielder",
          jersey_number: 8,
          position_id: 6,
          position_name: "Central Midfielder",
          image_path: null,
          rating: 8.1
        },
        {
          player_id: 4,
          player_name: "Alex Forward",
          jersey_number: 9,
          position_id: 9,
          position_name: "Striker",
          image_path: "https://via.placeholder.com/60x60?text=AF",
          rating: 7.5
        },
        {
          player_id: 5,
          player_name: "Tom Winger",
          jersey_number: 11,
          position_id: 10,
          position_name: "Left Winger",
          image_path: null,
          rating: 6.9
        }
      ]
    },
    player_ratings: [
      { player_id: 1, rating: 7.2 },
      { player_id: 2, rating: 6.8 },
      { player_id: 3, rating: 8.1 },
      { player_id: 4, rating: 7.5 },
      { player_id: 5, rating: 6.9 }
    ],
    player_of_the_match: "Sarah Midfielder" // Set Sarah as the man of the match for testing
  };

  const isHomeTeam = true; // Simulate viewing as home team

  return (
    <div className="match-live" style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>Formation Display Test</h1>
      
      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === "lineups" ? "active" : ""}`}
          onClick={() => setActiveTab("lineups")}
        >
          Lineups (Test)
        </button>
      </div>

      {/* Tab Content - Copy from your MatchLive component */}
      <div className="tab-content">
        {activeTab === "lineups" && (
          <div className="tab-panel lineups-panel">
            <div className="lineups-content">
              {(() => {
                // Get the correct lineup based on team side
                let teamLineup = null;
                let teamName = "";
                if (mockMatchSnapshot.lineup) {
                  if (isHomeTeam && mockMatchSnapshot.lineup.home) {
                    teamLineup = mockMatchSnapshot.lineup.home;
                    teamName = mockMatchSnapshot.teams.home?.team_name || "Home";
                  }
                }

                if (teamLineup && teamLineup.length) {
                  // Create a map of player ratings by player_id for quick lookup
                  const ratingsMap = new Map();
                  if (mockMatchSnapshot.player_ratings && Array.isArray(mockMatchSnapshot.player_ratings)) {
                    mockMatchSnapshot.player_ratings.forEach(rating => {
                      if (rating.player_id && rating.rating != null) {
                        ratingsMap.set(String(rating.player_id), rating.rating);
                      }
                    });
                  }

                  // Match lineup players with their ratings
                  const playersWithRatings = teamLineup.map(player => ({
                    ...player,
                    matchedRating: ratingsMap.get(String(player.player_id)) || player.rating || null
                  }));

                  // Sort players by position for formation display
                  const sortedLineup = [...playersWithRatings].sort((a, b) => {
                    const posA = a.position_id || 0;
                    const posB = b.position_id || 0;
                    return posA - posB;
                  });

                  return (
                    <div className="formation-display">
                      <h4>{teamName} Formation</h4>
                      
                      {/* Formation grid view */}
                      <div className="formation-grid">
                        {sortedLineup.map((player, i) => {
                          // Check if this player is the man of the match
                          const isManOfTheMatch = mockMatchSnapshot.player_of_the_match && 
                            (mockMatchSnapshot.player_of_the_match === player.player_name ||
                             mockMatchSnapshot.player_of_the_match.toLowerCase() === player.player_name?.toLowerCase());
                          
                          return (
                            <div key={i} className={`player-card ${isManOfTheMatch ? 'man-of-the-match' : ''}`}>
                              <div className="player-image-container">
                                {player.image_path ? (
                                  <img 
                                    src={player.image_path} 
                                    alt={player.player_name}
                                    className="player-image"
                                    onError={(e) => {
                                      e.target.style.display = 'none';
                                      e.target.nextSibling.style.display = 'flex';
                                    }}
                                  />
                                ) : null}
                                <div className="player-placeholder" style={{display: player.image_path ? 'none' : 'flex'}}>
                                  <span className="player-initials">
                                    {player.player_name ? 
                                      player.player_name.split(' ').map(n => n[0]).join('').substring(0, 2) : 
                                      '??'
                                    }
                                  </span>
                                </div>
                                
                                {player.jersey_number && (
                                  <div className="player-number">
                                    {player.jersey_number}
                                  </div>
                                )}
                              </div>
                              
                              <div className="player-info">
                                <div className="player-name">
                                  {player.player_name || 'Unknown Player'}
                                </div>
                                
                                <div className="player-details">
                                  {player.position_name && (
                                    <span className="player-position">
                                      {player.position_name}
                                    </span>
                                  )}
                                  {player.matchedRating != null && (
                                    <span className="player-rating">
                                      {player.matchedRating}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                return <p>Lineup not available</p>;
              })()}
            </div>
          </div>
        )}
      </div>
      
      <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0f0f0', borderRadius: '8px' }}>
        <h3>Test Features:</h3>
        <ul>
          <li>✅ Player cards in grid layout</li>
          <li>✅ Jersey numbers as overlays</li>
          <li>✅ Player images with fallback to initials</li>
          <li>✅ Position names and ratings display</li>
          <li>✅ Man of the Match highlighting with golden glow</li>
          <li>✅ Trophy icon for Man of the Match</li>
          <li>✅ Responsive design</li>
        </ul>
        
        <p><strong>Current MOTM:</strong> {mockMatchSnapshot.player_of_the_match || 'None'}</p>
        <p><strong>To test with real data:</strong> Navigate to any match page and click the "Lineups" tab.</p>
      </div>
    </div>
  );
};

export default FormationTestComponent;