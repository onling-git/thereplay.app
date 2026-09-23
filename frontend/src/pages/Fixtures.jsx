import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  getAllFixtures,
  getFixtureCountries,
  getFixtureLeagues,
  getFixtureTeams,
} from "../api";
// import Header from "../components/Header/Header";
// import FooterNav from "../components/FooterNav/FooterNav";
import FavoriteButton from "../components/Favorites/FavoriteButton";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";
import calendarIcon from "../assets/images/calendar-regular-full.svg";
import "./css/fixtures.css";

// Number of matches fetched per page
const PAGE_SIZE = 100;

// Helper function to generate team slug from team name
const slugify = (str) => {
  return String(str || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
};

// Merge a newly fetched page of country/league fixtures into the existing tree
const mergeFixturePages = (existing, incoming) => {
  const countryMap = new Map(existing.map((c) => [c.id, c]));

  incoming.forEach((incomingCountry) => {
    const existingCountry = countryMap.get(incomingCountry.id);
    if (!existingCountry) {
      countryMap.set(incomingCountry.id, incomingCountry);
      return;
    }

    const leagueMap = new Map(
      existingCountry.leagues.map((l) => [l.id, l]),
    );

    incomingCountry.leagues.forEach((incomingLeague) => {
      const existingLeague = leagueMap.get(incomingLeague.id);
      if (!existingLeague) {
        leagueMap.set(incomingLeague.id, incomingLeague);
        return;
      }

      const seenMatchIds = new Set(
        existingLeague.fixtures.map((f) => f.match_id),
      );
      const mergedFixtures = existingLeague.fixtures.concat(
        incomingLeague.fixtures.filter(
          (f) => !seenMatchIds.has(f.match_id),
        ),
      );
      leagueMap.set(incomingLeague.id, {
        ...existingLeague,
        fixtures: mergedFixtures,
      });
    });

    countryMap.set(incomingCountry.id, {
      ...existingCountry,
      leagues: Array.from(leagueMap.values()),
    });
  });

  return Array.from(countryMap.values());
};

const Fixtures = () => {
  const [fixtureData, setFixtureData] = useState([]);
  const [countries, setCountries] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedLeague, setSelectedLeague] = useState("");
  const [selectedLeagueName, setSelectedLeagueName] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedTeamName, setSelectedTeamName] = useState("");
  const [showLiveOnly, setShowLiveOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCountries, setExpandedCountries] = useState(new Set());
  const [expandedLeagues, setExpandedLeagues] = useState(new Set());
  const [pagination, setPagination] = useState({
    total: 0,
    offset: 0,
    hasMore: false,
  });

  // League search state
  const [allLeagues, setAllLeagues] = useState([]);
  const [leagueQuery, setLeagueQuery] = useState("");
  const [leagueSuggestions, setLeagueSuggestions] = useState([]);
  const [showLeagueSuggestions, setShowLeagueSuggestions] = useState(false);
  const leagueSearchRef = useRef(null);

  // Team search state - scoped to the selected league (if any)
  const [allTeams, setAllTeams] = useState([]);
  const [teamQuery, setTeamQuery] = useState("");
  const [teamSuggestions, setTeamSuggestions] = useState([]);
  const [showTeamSuggestions, setShowTeamSuggestions] = useState(false);
  const teamSearchRef = useRef(null);

  // Sky Sports-style day strip + "jump to date" calendar modal
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateInputRef = useRef(null);

  // Get today's date in YYYY-MM-DD format
  const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  };

  // Build the 7-day strip (3 days back, today, 3 days ahead)
  const generateStripDates = () => {
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = -3; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const toDateString = (date) => date.toISOString().split("T")[0];

  const formatStripDay = (date) =>
    date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();

  const formatStripDate = (date) => {
    if (toDateString(date) === getTodayString()) return "TODAY";
    return date.toLocaleDateString("en-US", { month: "short", day: "2-digit" });
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
    setSelectedLeagueName("");
    setLeagueQuery("");
    setSelectedTeam("");
    setSelectedTeamName("");
    setTeamQuery("");
    setShowLiveOnly(false);
  };

  // Get country name helper function
  const getCountryName = (countryId) => {
    const country = countries.find((c) => c.id === parseInt(countryId));
    return country ? country.name : `Country ${countryId}`;
  };

  const buildFixtureParams = () => {
    const params = {};
    if (selectedDate && !showLiveOnly) params.date = selectedDate;
    if (selectedCountry) params.country = selectedCountry;
    if (selectedLeague) params.league = selectedLeague;
    if (selectedTeam) params.team = selectedTeam;
    if (showLiveOnly) params.live = "true";
    return params;
  };

  // Load fixtures (first page) whenever filters change
  useEffect(() => {
    const loadFixtures = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = {
          ...buildFixtureParams(),
          limit: PAGE_SIZE,
          offset: 0,
        };

        const response = await getAllFixtures(params);
        const newFixtures = response.fixtures || [];
        setFixtureData(newFixtures);
        setPagination({
          total: response.pagination?.total || 0,
          offset: 0,
          hasMore: !!response.pagination?.hasMore,
        });

        // Auto-expand countries and leagues when filtered
        if (selectedCountry || selectedLeague || selectedTeam) {
          const newExpandedCountries = new Set();
          const newExpandedLeagues = new Set();

          newFixtures.forEach((country) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, selectedCountry, selectedLeague, selectedTeam, showLiveOnly]);

  // Fetch the next page of fixtures and merge into the existing tree
  const loadMoreFixtures = async () => {
    if (loadingMore || !pagination.hasMore) return;
    setLoadingMore(true);
    try {
      const nextOffset = pagination.offset + PAGE_SIZE;
      const params = {
        ...buildFixtureParams(),
        limit: PAGE_SIZE,
        offset: nextOffset,
      };
      const response = await getAllFixtures(params);
      const newFixtures = response.fixtures || [];
      setFixtureData((prev) => mergeFixturePages(prev, newFixtures));
      setPagination({
        total: response.pagination?.total || 0,
        offset: nextOffset,
        hasMore: !!response.pagination?.hasMore,
      });
    } catch (err) {
      console.error("Error loading more fixtures:", err);
      setError("Failed to load more fixtures");
    } finally {
      setLoadingMore(false);
    }
  };

  // Load countries for the country dropdown
  useEffect(() => {
    const loadCountries = async () => {
      try {
        const countriesData = await getFixtureCountries();
        setCountries(countriesData || []);
      } catch (err) {
        console.error("Error loading countries:", err);
      }
    };

    loadCountries();
  }, []);

  // Load all leagues once for the league search box (re-fetched when country changes)
  useEffect(() => {
    const loadLeagues = async () => {
      try {
        const leaguesData = await getFixtureLeagues(selectedCountry || null);
        setAllLeagues(leaguesData || []);
      } catch (err) {
        console.error("Error loading leagues:", err);
      }
    };

    loadLeagues();
  }, [selectedCountry]);

  // Load teams for the team search box, scoped to the selected league so a user
  // who has picked e.g. "Championship" can only search for Championship teams
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const teamsData = await getFixtureTeams(selectedLeague || null);
        setAllTeams(teamsData || []);
      } catch (err) {
        console.error("Error loading teams:", err);
      }
    };

    loadTeams();
  }, [selectedLeague]);

  // If the previously selected team isn't part of the newly selected league, clear it
  useEffect(() => {
    if (!selectedTeam) return;
    if (allTeams.length === 0) return;
    const stillValid = allTeams.some((t) => String(t.id) === selectedTeam);
    if (!stillValid) {
      setSelectedTeam("");
      setSelectedTeamName("");
      setTeamQuery("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allTeams]);

  // Filter league suggestions as the user types
  useEffect(() => {
    if (!leagueQuery.trim()) {
      setLeagueSuggestions([]);
      return;
    }
    const q = leagueQuery.toLowerCase();
    setLeagueSuggestions(
      allLeagues
        .filter((l) => l.name && l.name.toLowerCase().includes(q))
        .slice(0, 8),
    );
  }, [leagueQuery, allLeagues]);

  // Filter team suggestions as the user types
  useEffect(() => {
    if (!teamQuery.trim()) {
      setTeamSuggestions([]);
      return;
    }
    const q = teamQuery.toLowerCase();
    setTeamSuggestions(
      allTeams
        .filter((t) => t.name && t.name.toLowerCase().includes(q))
        .slice(0, 8),
    );
  }, [teamQuery, allTeams]);

  // Close search suggestion dropdowns when clicking outside of them
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        leagueSearchRef.current &&
        !leagueSearchRef.current.contains(event.target)
      ) {
        setShowLeagueSuggestions(false);
      }
      if (
        teamSearchRef.current &&
        !teamSearchRef.current.contains(event.target)
      ) {
        setShowTeamSuggestions(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectLeague = (leagueOption) => {
    setSelectedLeague(String(leagueOption.id));
    setSelectedLeagueName(leagueOption.name);
    setLeagueQuery(leagueOption.name);
    setShowLeagueSuggestions(false);
  };

  const handleSelectTeam = (team) => {
    setSelectedTeam(String(team.id));
    setSelectedTeamName(team.name);
    setTeamQuery(team.name);
    setShowTeamSuggestions(false);
  };

  const clearLeagueSelection = () => {
    setSelectedLeague("");
    setSelectedLeagueName("");
    setLeagueQuery("");
  };

  const clearTeamSelection = () => {
    setSelectedTeam("");
    setSelectedTeamName("");
    setTeamQuery("");
  };

  const isTodaySelected = selectedDate === getTodayString();

  // Select a date from the strip or calendar modal; live-only only makes sense for today
  const selectDate = (dateStr) => {
    setSelectedDate(dateStr);
    if (dateStr !== getTodayString()) {
      setShowLiveOnly(false);
    }
  };

  // Auto-open the native date picker when the "jump to date" modal appears
  useEffect(() => {
    if (showDatePicker && dateInputRef.current) {
      setTimeout(() => {
        if (dateInputRef.current) {
          try {
            if (typeof dateInputRef.current.showPicker === "function") {
              dateInputRef.current.showPicker();
            } else {
              dateInputRef.current.click();
            }
          } catch (error) {
            dateInputRef.current.click();
          }
        }
      }, 100);
    }
  }, [showDatePicker]);

  // Initialize with today's date and expand first few countries
  useEffect(() => {
    if (!selectedDate) {
      setSelectedDate(getTodayString());
    }

    // Auto-expand first 3 countries on initial load when no filters
    if (
      !selectedCountry &&
      !selectedLeague &&
      !selectedTeam &&
      fixtureData.length > 0
    ) {
      const newExpanded = new Set();
      fixtureData.slice(0, 3).forEach((country) => {
        newExpanded.add(country.id);
      });
      setExpandedCountries(newExpanded);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, fixtureData, selectedCountry, selectedLeague, selectedTeam]);

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
            Showing {totalFixtures} of {pagination.total} football matches
            {showLiveOnly
              ? " currently live"
              : selectedDate
                ? ` scheduled for ${selectedDate} `
                : " today"}
             across {fixtureData.length} countries and multiple competitions.
          </p>

          <div className="card fixture-filter-card">
            <div className="filter-header">
              <h6 className="accent-heading">This is some text</h6>
            </div>
            <div className="filter-row fixture-date-row">
              <ul className="fixture-day-strip">
                {generateStripDates().map((date) => {
                  const dateStr = toDateString(date);
                  const isSelected = selectedDate === dateStr;
                  return (
                    <li
                      key={dateStr}
                      className={isSelected ? "selected" : ""}
                      onClick={() => selectDate(dateStr)}
                    >
                      <div>
                        <p className="fixture-day-strip-day">
                          {formatStripDay(date)}
                        </p>
                        <p className="fixture-day-strip-date">
                          {formatStripDate(date)}
                        </p>
                      </div>
                    </li>
                  );
                })}
                <li
                  className="fixture-day-strip-calendar"
                  onClick={() => setShowDatePicker(true)}
                >
                  <img src={calendarIcon} alt="Pick a date" title="Pick a specific date" />
                </li>
              </ul>

              {isTodaySelected && (
                <div className="filter-group fixture-live-toggle">
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
              )}
            </div>

            {showDatePicker && (
              <div
                className="fixture-date-picker-overlay"
                onClick={(e) =>
                  e.target === e.currentTarget && setShowDatePicker(false)
                }
              >
                <div className="fixture-date-picker-modal">
                  <div className="fixture-date-picker-header">
                    <h3>Select Date</h3>
                    <button
                      onClick={() => setShowDatePicker(false)}
                      className="close-button"
                    >
                      ×
                    </button>
                  </div>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={selectedDate || ""}
                    onChange={(e) => {
                      if (e.target.value) {
                        selectDate(e.target.value);
                        setShowDatePicker(false);
                      }
                    }}
                    className="fixture-date-picker-input"
                  />
                </div>
              </div>
            )}

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

              <div className="filter-group fixture-search-group" ref={leagueSearchRef}>
                <label htmlFor="fixture-league-search">League:</label>
                <div className="fixture-search-input-wrapper">
                  <input
                    id="fixture-league-search"
                    type="text"
                    className="fixture-search-input"
                    placeholder="Search leagues..."
                    value={leagueQuery}
                    onChange={(e) => {
                      setLeagueQuery(e.target.value);
                      setShowLeagueSuggestions(true);
                      if (!e.target.value) clearLeagueSelection();
                    }}
                    onFocus={() =>
                      leagueQuery && setShowLeagueSuggestions(true)
                    }
                  />
                  {selectedLeagueName && (
                    <button
                      type="button"
                      className="fixture-search-clear"
                      onClick={clearLeagueSelection}
                      aria-label="Clear league"
                    >
                      ×
                    </button>
                  )}
                </div>
                {showLeagueSuggestions && leagueSuggestions.length > 0 && (
                  <div className="fixture-search-suggestions">
                    {leagueSuggestions.map((leagueOption) => (
                      <div
                        key={leagueOption.id}
                        className="fixture-search-suggestion"
                        onClick={() => handleSelectLeague(leagueOption)}
                      >
                        {leagueOption.image_path && (
                          <img
                            src={leagueOption.image_path}
                            alt=""
                            className="fixture-search-suggestion-logo"
                            onError={(e) => (e.target.style.display = "none")}
                          />
                        )}
                        <span>{leagueOption.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {showLeagueSuggestions &&
                  leagueQuery &&
                  leagueSuggestions.length === 0 && (
                    <div className="fixture-search-suggestions">
                      <div className="fixture-search-suggestion no-results">
                        No leagues found
                      </div>
                    </div>
                  )}
              </div>

              <div className="filter-group fixture-search-group" ref={teamSearchRef}>
                <label htmlFor="fixture-team-search">Team:</label>
                <div className="fixture-search-input-wrapper">
                  <input
                    id="fixture-team-search"
                    type="text"
                    className="fixture-search-input"
                    placeholder={
                      selectedLeagueName
                        ? `Search ${selectedLeagueName} teams...`
                        : "Search teams..."
                    }
                    value={teamQuery}
                    onChange={(e) => {
                      setTeamQuery(e.target.value);
                      setShowTeamSuggestions(true);
                      if (!e.target.value) clearTeamSelection();
                    }}
                    onFocus={() => teamQuery && setShowTeamSuggestions(true)}
                  />
                  {selectedTeamName && (
                    <button
                      type="button"
                      className="fixture-search-clear"
                      onClick={clearTeamSelection}
                      aria-label="Clear team"
                    >
                      ×
                    </button>
                  )}
                </div>
                {showTeamSuggestions && teamSuggestions.length > 0 && (
                  <div className="fixture-search-suggestions">
                    {teamSuggestions.map((team) => (
                      <div
                        key={team.id || team._id}
                        className="fixture-search-suggestion"
                        onClick={() => handleSelectTeam(team)}
                      >
                        {team.image_path && (
                          <img
                            src={team.image_path}
                            alt=""
                            className="fixture-search-suggestion-logo"
                            onError={(e) => (e.target.style.display = "none")}
                          />
                        )}
                        <span>{team.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {showTeamSuggestions &&
                  teamQuery &&
                  teamSuggestions.length === 0 && (
                    <div className="fixture-search-suggestions">
                      <div className="fixture-search-suggestion no-results">
                        No teams found
                      </div>
                    </div>
                  )}
              </div>

              {(selectedCountry ||
                selectedLeague ||
                selectedTeam ||
                showLiveOnly) && (
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
                const countryName = country.name || getCountryName(country.id);
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

        {pagination.hasMore && (
          <div className="fixtures-load-more">
            <button
              onClick={loadMoreFixtures}
              disabled={loadingMore}
              className="btn load-more-btn"
            >
              {loadingMore
                ? "Loading..."
                : `Load More (${totalFixtures} of ${pagination.total})`}
            </button>
          </div>
        )}

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
