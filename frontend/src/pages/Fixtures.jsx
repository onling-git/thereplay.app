import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { getAllFixtures, getFixtureCountries, getFixtureLeagues } from "../api";
// import Header from "../components/Header/Header";
// import FooterNav from "../components/FooterNav/FooterNav";
import FavoriteButton from "../components/Favorites/FavoriteButton";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";
import "./css/fixtures.css";

// Helper function to generate team slug from team name
const slugify = (str) => {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
};

const Fixtures = () => {
  const [fixtureData, setFixtureData] = useState([]);
  const [countries, setCountries] = useState([]);
  const [leagues, setLeagues] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedLeague, setSelectedLeague] = useState("");
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedCountries, setExpandedCountries] = useState(new Set());
  const [expandedLeagues, setExpandedLeagues] = useState(new Set());

  // Get today's date in YYYY-MM-DD format
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // Format match time with proper timezone handling
  const formatMatchTime = (match) => {
    let date;
    if (
      match.match_info?.starting_at_timestamp &&
      Number.isFinite(match.match_info.starting_at_timestamp)
    ) {
      date = new Date(match.match_info.starting_at_timestamp * 1000);
    } else if (match.match_info?.starting_at) {
      date = new Date(match.match_info.starting_at);
    } else {
      return "TBD";
    }

    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  // Format match status
  const getMatchStatus = (match) => {
    if (match.match_status?.short_name) {
      return match.match_status.short_name;
    }
    return match.status || "NS";
  };

  // Check if match is live
  const isMatchLive = (match) => {
    const status = getMatchStatus(match);
    return (
      ["LIVE", "1H", "2H", "HT", "ET"].includes(status) ||
      (match.minute && match.minute > 0)
    );
  };

  // Get match result or time
  const getMatchDisplay = (match) => {
    const status = getMatchStatus(match);

    if (["FT", "AET", "PEN"].includes(status)) {
      return `${match.score?.home || 0} - ${match.score?.away || 0}`;
    } else if (["1H", "2H", "HT", "ET"].includes(status)) {
      return `${match.score?.home || 0} - ${match.score?.away || 0} (${status})`;
    } else if (status === "NS" || status === "TBD") {
      return formatMatchTime(match);
    }

    return `${match.score?.home || 0} - ${match.score?.away || 0}`;
  };

  // Toggle country expansion
  const toggleCountry = (countryId) => {
    const newExpanded = new Set(expandedCountries);
    if (newExpanded.has(countryId)) {
      newExpanded.delete(countryId);
      // Also collapse all leagues in this country
      const newExpandedLeagues = new Set(expandedLeagues);
      const country = fixtureData.find((c) => c.id === countryId);
      if (country) {
        country.leagues.forEach((league) =>
          newExpandedLeagues.delete(`${countryId}-${league.id}`),
        );
      }
      setExpandedLeagues(newExpandedLeagues);
    } else {
      newExpanded.add(countryId);
    }
    setExpandedCountries(newExpanded);
  };

  // Toggle league expansion
  const toggleLeague = (countryId, leagueId) => {
    const leagueKey = `${countryId}-${leagueId}`;
    const newExpanded = new Set(expandedLeagues);
    if (newExpanded.has(leagueKey)) {
      newExpanded.delete(leagueKey);
    } else {
      newExpanded.add(leagueKey);
    }
    setExpandedLeagues(newExpanded);
  };

  // Clear all filters
  const clearFilters = () => {
    setSelectedCountry("");
    setSelectedLeague("");
    setShowLiveOnly(false);
  };

  // Get country name helper function
  const getCountryName = (countryId) => {
    const country = countries.find((c) => c.id === parseInt(countryId));
    return country ? country.name : `Country ${countryId}`;
  };

  // Load fixtures
  useEffect(() => {
    const loadFixtures = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = {};
        if (selectedDate && !showLiveOnly) params.date = selectedDate;
        if (selectedCountry) params.country = selectedCountry;
        if (selectedLeague) params.league = selectedLeague;
        if (showLiveOnly) params.live = "true";

        const response = await getAllFixtures(params);
        setFixtureData(response.fixtures || []);

        // Auto-expand countries and leagues when filtered
        if (selectedCountry || selectedLeague) {
          const newExpandedCountries = new Set();
          const newExpandedLeagues = new Set();

          response.fixtures?.forEach((country) => {
            newExpandedCountries.add(country.id);
            country.leagues.forEach((league) => {
              newExpandedLeagues.add(`${country.id}-${league.id}`);
            });
          });

          setExpandedCountries(newExpandedCountries);
          setExpandedLeagues(newExpandedLeagues);
        }
      } catch (err) {
        console.error("Error loading fixtures:", err);
        setError("Failed to load fixtures");
      } finally {
        setLoading(false);
      }
    };

    loadFixtures();
  }, [selectedDate, selectedCountry, selectedLeague, showLiveOnly]);

  // Load countries and leagues for filters
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [countriesData, leaguesData] = await Promise.all([
          getFixtureCountries(),
          getFixtureLeagues(selectedCountry || null),
        ]);
        setCountries(countriesData || []);
        setLeagues(leaguesData || []);
      } catch (err) {
        console.error("Error loading filter data:", err);
      }
    };

    loadFilters();
  }, [selectedCountry]);

  // Initialize with today's date and expand first few countries
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(getTodayString());
    }

    // Auto-expand first 3 countries on initial load when no filters
    if (!selectedCountry && !selectedLeague && fixtureData.length > 0) {
      const newExpanded = new Set();
      fixtureData.slice(0, 3).forEach((country) => {
        newExpanded.add(country.id);
      });
      setExpandedCountries(newExpanded);
    }
  }, [selectedDate, fixtureData, selectedCountry, selectedLeague]);

  // Calculate total fixtures count
  const totalFixtures = fixtureData.reduce((total, country) => {
    return (
      total +
      country.leagues.reduce((countryTotal, league) => {
        return countryTotal + league.fixtures.length;
      }, 0)
    );
  }, 0);

  if (loading) {
    return (
      <div>
        <div className="fixtures-loading">Loading fixtures...</div>
      </div>
    );
  }

  return (
    <div>
      <div className="fixtures">
        {/* Header Ad */}
        <AdSenseAd
          slot="5183171853"
          format="auto"
          className="adsense-header adsense-banner"
        />
        <PremiumBanner />

        <div className="fixtures-header">
          <h1>Football Fixtures</h1>
          <p className="fixtures-intro">
            Browse today’s football fixtures, upcoming matches, and live games
            from leagues around the world. Use filters to find matches by date,
            country, or competition and follow live scores in real time.
          </p>
          <p className="fixtures-subtitle">
            {totalFixtures} football matches
            {showLiveOnly
              ? " currently live"
              : selectedDate
                ? ` scheduled for ${selectedDate} `
                : " today"}
             across {fixtureData.length} countries and multiple competitions.
          </p>

          <div className="fixtures-filters">
            <div className="filter-row">
              <div className="filter-group">
                <label>Date:</label>
                <div className="date-selector-container">
                  <div className="date-quick-buttons">
                    <button
                      onClick={() => setSelectedDate(getTodayString())}
                      className={`btn ${selectedDate === getTodayString() ? "active" : ""}`}
                      disabled={showLiveOnly}
                    >
                      Today
                    </button>
                    <button
                      onClick={() => {
                        const tomorrow = new Date();
                        tomorrow.setDate(tomorrow.getDate() + 1);
                        setSelectedDate(tomorrow.toISOString().split("T")[0]);
                      }}
                      className={`btn ${
                        selectedDate ===
                        (() => {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          return tomorrow.toISOString().split("T")[0];
                        })()
                          ? "active"
                          : ""
                      }`}
                      disabled={showLiveOnly}
                    >
                      Tomorrow
                    </button>
                  </div>
                  <div className="date-picker-group">
                    <input
                      type="date"
                      value={selectedDate || ""}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="date-picker"
                      disabled={showLiveOnly}
                      min={getTodayString()}
                    />
                  </div>
                </div>
              </div>

              <div className="filter-group">
                <label>
                  <input
                    type="checkbox"
                    checked={showLiveOnly}
                    onChange={(e) => setShowLiveOnly(e.target.checked)}
                    className="live-checkbox"
                  />
                  <span className="live-label">🔴 Live Games Only</span>
                </label>
              </div>
            </div>

            <div className="filter-row">
              <div className="filter-group">
                <label htmlFor="fixture-country">Country:</label>
                <select
                  id="fixture-country"
                  value={selectedCountry}
                  onChange={(e) => {
                    setSelectedCountry(e.target.value);
                    setSelectedLeague(""); // Clear league when country changes
                  }}
                  className="filter-select"
                >
                  <option value="">All Countries</option>
                  {countries.map((country) => (
                    <option key={country.id} value={country.id}>
                      {country.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="filter-group">
                <label htmlFor="fixture-league">League:</label>
                <select
                  id="fixture-league"
                  value={selectedLeague}
                  onChange={(e) => setSelectedLeague(e.target.value)}
                  className="filter-select"
                  disabled={!selectedCountry && leagues.length === 0}
                >
                  <option value="">All Leagues</option>
                  {leagues.map((league) => (
                    <option key={league.id} value={league.id}>
                      {league.name}
                    </option>
                  ))}
                </select>
              </div>

              {(selectedCountry || selectedLeague || showLiveOnly) && (
                <button onClick={clearFilters} className="clear-filters-btn">
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}

        {/* Inline Ad */}
        <AdSenseAd
          slot="8038180302"
          format="rectangle"
          className="adsense-inline adsense-medium-rectangle"
        />

        <div className="fixtures-container">
          {fixtureData.length === 0 ? (
            <div className="no-fixtures">
              <p>No fixtures found for the selected criteria.</p>
              <p>Try selecting a different date or clearing the filters.</p>
            </div>
          ) : (
            <div className="fixtures-by-country">
              {fixtureData.map((country) => {
                console.log("this is the country: ", country);

                const countryName = getCountryName(country.id);
                return (
                  <div key={country.id} className="country-section">
                    <div
                      className="country-header"
                      onClick={() => toggleCountry(country.id)}
                    >
                      <h2>{countryName}</h2>
                      <span className="country-stats">
                        {country.leagues.length} leagues •{" "}
                        {country.leagues.reduce(
                          (total, league) => total + league.fixtures.length,
                          0,
                        )}{" "}
                        fixtures
                      </span>
                      <span
                        className={`expand-icon ${expandedCountries.has(country.id) ? "expanded" : ""}`}
                      >
                        ▼
                      </span>
                    </div>

                    {expandedCountries.has(country.id) && (
                      <div className="leagues-container">
                        {country.leagues.map((league) => (
                          <div key={league.id} className="league-section">
                            <div
                              className="league-header"
                              onClick={() =>
                                toggleLeague(country.id, league.id)
                              }
                            >
                              <h3>
                                {league.image_path && (
                                  <img
                                    src={league.image_path}
                                    alt={league.name}
                                    className="league-logo"
                                    onError={(e) =>
                                      (e.target.style.display = "none")
                                    }
                                  />
                                )}
                                {league.name}
                              </h3>
                              <span className="league-stats">
                                {league.fixtures.length} fixtures
                              </span>
                              <span
                                className={`expand-icon ${expandedLeagues.has(`${country.id}-${league.id}`) ? "expanded" : ""}`}
                              >
                                ▼
                              </span>
                            </div>

                            {expandedLeagues.has(
                              `${country.id}-${league.id}`,
                            ) && (
                              <div className="fixtures-list">
                                {league.fixtures.map((match) => (
                                  <div
                                    key={match.match_id}
                                    className={`fixture-card ${isMatchLive(match) ? "live-match" : ""}`}
                                  >
                                    <div className="fixture-header">
                                      <div className="fixture-info-top">
                                        <div className="fixture-favorite">
                                          <FavoriteButton
                                            matchId={match.match_id}
                                            size="small"
                                          />
                                        </div>
                                        <div className="fixture-league-info">
                                          <span className="league-identifier">
                                            {league.name}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="fixture-match-info">
                                        {isMatchLive(match) && (
                                          <span className="live-indicator">
                                            🔴 LIVE
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    <div className="fixture-teams">
                                      <div className="home-team">
                                        <Link
                                          to={`/${match.teams?.home?.team_slug || slugify(match.teams?.home?.team_name)}/match/${match.match_id}/live`}
                                          className="team-name-link"
                                        >
                                          <span className="team-name">
                                            {match.teams?.home?.team_name ||
                                              "Home Team"}
                                          </span>
                                        </Link>
                                      </div>

                                      <div className="fixture-score">
                                        <span className="score-display">
                                          {getMatchDisplay(match)}
                                        </span>
                                        {match.minute && (
                                          <span className="match-minute">
                                            {match.minute}'
                                          </span>
                                        )}
                                      </div>

                                      <div className="away-team">
                                        <Link
                                          to={`/${match.teams?.away?.team_slug || slugify(match.teams?.away?.team_name)}/match/${match.match_id}/live`}
                                          className="team-name-link"
                                        >
                                          <span className="team-name">
                                            {match.teams?.away?.team_name ||
                                              "Away Team"}
                                          </span>
                                        </Link>
                                      </div>
                                    </div>

                                    <div className="fixture-info">
                                      <span className="match-status">
                                        {getMatchStatus(match)}
                                      </span>
                                      {match.match_info?.venue?.name && (
                                        <span className="venue">
                                          @ {match.match_info.venue.name}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
    </div>
  );
};

export default Fixtures;
