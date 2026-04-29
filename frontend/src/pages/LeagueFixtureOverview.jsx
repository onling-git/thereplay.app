import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getLeagueFixtures, getLeagues } from "../api";
import Header from "../components/Header/Header";
import FooterNav from "../components/FooterNav/FooterNav";
import FavoriteButton from "../components/Favorites/FavoriteButton";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";
import "./css/leagueFixtures.css";

const LeagueFixtureOverview = () => {
  const { leagueId } = useParams();
  const [fixtures, setFixtures] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get today's date in YYYY-MM-DD format
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Get league name from leagues list
  const getLeagueName = () => {
    const league = leagues.find(l => l.id === parseInt(leagueId));
    return league ? league.name : `League ${leagueId}`;
  };

  // Format match time with proper timezone handling
  const formatMatchTime = (match) => {
    // Priority 1: Use starting_at_timestamp if available (guaranteed UTC)
    let date;
    if (match.match_info?.starting_at_timestamp && Number.isFinite(match.match_info.starting_at_timestamp)) {
      date = new Date(match.match_info.starting_at_timestamp * 1000);
    } else if (match.match_info?.starting_at) {
      date = new Date(match.match_info.starting_at);
    } else if (match.date) {
      date = new Date(match.date);
      console.warn('⚠️ Using match.date for timezone - may be inaccurate');
    } else {
      return 'TBD';
    }
    
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Format match status
  const getMatchStatus = (match) => {
    if (match.match_status?.short_name) {
      return match.match_status.short_name;
    }
    return match.status || 'NS';
  };

  // Get match result or time
  const getMatchDisplay = (match) => {
    const status = getMatchStatus(match);
    
    if (['FT', 'AET', 'PEN'].includes(status)) {
      return `${match.score?.home || 0} - ${match.score?.away || 0}`;
    } else if (['1H', '2H', 'HT'].includes(status)) {
      return `${match.score?.home || 0} - ${match.score?.away || 0} (${status})`;
    } else if (status === 'NS' || status === 'TBD') {
      return formatMatchTime(match);
    }
    
    return `${match.score?.home || 0} - ${match.score?.away || 0}`;
  };

  // Load fixtures
  useEffect(() => {
    const loadFixtures = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const fixturesData = await getLeagueFixtures(leagueId, selectedDate || null);
        setFixtures(fixturesData);
      } catch (err) {
        console.error('Error loading fixtures:', err);
        setError('Failed to load fixtures');
      } finally {
        setLoading(false);
      }
    };

    if (leagueId) {
      loadFixtures();
    }
  }, [leagueId, selectedDate]);

  // Load leagues for league name display
  useEffect(() => {
    const loadLeagues = async () => {
      try {
        const leaguesData = await getLeagues();
        setLeagues(leaguesData);
      } catch (err) {
        console.error('Error loading leagues:', err);
      }
    };

    loadLeagues();
  }, []);

  // Initialize with today's date
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(getTodayString());
    }
  }, [selectedDate]);

  if (loading) {
    return (
      <div>
        <Header />
        <div className="league-fixtures-loading">Loading fixtures...</div>
        <FooterNav />
      </div>
    );
  }

  return (
    <div>
      <Header />
      <div className="league-fixtures">
        {/* Header Ad */}
        <AdSenseAd
          slot="5183171853"
          format="auto"
          className="adsense-header adsense-banner"
        />
        <PremiumBanner />

        <div className="league-fixtures-header">
          <h1>{getLeagueName()} Fixtures</h1>
          
          <div className="date-selector">
            <label htmlFor="fixture-date">Select Date:</label>
            <input
              id="fixture-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="date-input"
            />
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Inline Ad */}
        <AdSenseAd
          slot="8038180302"
          format="rectangle"
          className="adsense-inline adsense-medium-rectangle"
        />

        <div className="fixtures-container">
          {fixtures.length === 0 ? (
            <div className="no-fixtures">
              <p>No fixtures found for {selectedDate || 'today'}.</p>
              <p>Try selecting a different date.</p>
            </div>
          ) : (
            <div className="fixtures-list">
              {fixtures.map((match) => (
                <div key={match.match_id} className="fixture-card">
                  <div className="fixture-header">
                    <div className="fixture-favorite">
                      <FavoriteButton 
                        matchId={match.match_id} 
                        size="small"
                      />
                    </div>
                  </div>
                  
                  <div className="fixture-teams">
                    <div className="home-team">
                      <span className="team-name">
                        {match.teams?.home?.team_name || 'Home Team'}
                      </span>
                    </div>
                    
                    <div className="fixture-score">
                      <span className="score-display">
                        {getMatchDisplay(match)}
                      </span>
                      {match.minute && (
                        <span className="match-minute">{match.minute}'</span>
                      )}
                    </div>
                    
                    <div className="away-team">
                      <span className="team-name">
                        {match.teams?.away?.team_name || 'Away Team'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="fixture-info">
                    <span className="match-status">
                      {getMatchStatus(match)}
                    </span>
                    {match.match_info?.venue && (
                      <span className="venue">
                        @ {match.match_info.venue}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Ad */}
        <AdSenseAd
          slot="8038180302"
          format="auto"
          className="adsense-footer adsense-leaderboard"
        />
      </div>
      <FooterNav />
    </div>
  );
};

export default LeagueFixtureOverview;