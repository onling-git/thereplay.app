// src/pages/FollowedFixtures.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getTeamPreferences } from "../api/auth";
import { getFavoriteMatches } from "../api/favorites";
import FavoriteButton from "../components/Favorites/FavoriteButton";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";
import AuthModal from "../components/Auth/AuthModal";
import "./css/followedFixtures.css";

const API_BASE =
  process.env.REACT_APP_API_BASE ||
  "https://virtuous-exploration-production.up.railway.app";

const FollowedFixtures = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [followedTeams, setFollowedTeams] = useState([]);
  const [favoriteTeam, setFavoriteTeam] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [filter, setFilter] = useState("all");

  // Scroll to top when navigating to this page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Utility functions
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isUpcoming = (dateString) => {
    return new Date(dateString) > new Date();
  };

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    fetchTeamPreferences();
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMatches();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [followedTeams, favoriteTeam, selectedDate, isAuthenticated]);

  const fetchTeamPreferences = async () => {
    try {
      const response = await getTeamPreferences();
      const preferences = response.data?.team_preferences || {};

      setFavoriteTeam(preferences.favourite_team);
      setFollowedTeams(preferences.followed_teams || []);
    } catch (err) {
      console.error("Failed to fetch team preferences:", err);
      setError("Failed to load your team preferences.");
    }
  };

  const fetchMatches = async () => {
    try {
      setLoading(true);

      // Fetch both team-based matches and individual favorite matches in parallel
      const promises = [];

      // 1. Fetch matches for followed/favorite teams
      const allTeamIds = [];
      if (favoriteTeam) allTeamIds.push(favoriteTeam);
      if (followedTeams.length > 0) allTeamIds.push(...followedTeams);

      if (allTeamIds.length > 0) {
        console.log("Fetching matches for teams:", allTeamIds);

        const dateParam = selectedDate; // Always use the selected date
        const baseUrl = `${API_BASE}/api/matches/by-teams?teams=${allTeamIds.join(",")}`;
        const url = dateParam ? `${baseUrl}&date=${dateParam}` : baseUrl;

        promises.push(
          fetch(url)
            .then((response) => {
              if (!response.ok) {
                throw new Error("Failed to fetch team matches");
              }
              return response.json();
            })
            .then((data) => {
              console.log("Team matches data:", data);
              return (data.matches || []).map((match) => ({
                ...match,
                source:
                  match.source ||
                  (allTeamIds.includes(favoriteTeam) &&
                  (match.teams?.home?.team_id === favoriteTeam ||
                    match.teams?.away?.team_id === favoriteTeam)
                    ? "auto_favorite_team"
                    : "auto_followed_team"),
              }));
            })
            .catch((error) => {
              console.error("Failed to fetch team matches:", error);
              return [];
            }),
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      // 2. Fetch individually favorited matches
      const favoriteParams = {};
      if (selectedDate) {
        // If a date is selected, we'll need to filter manually since the API doesn't support date filtering
        // For now, fetch all and filter client-side
      }

      promises.push(
        getFavoriteMatches(favoriteParams)
          .then((response) => {
            console.log("Individual favorite matches:", response);
            const favoriteMatches = response?.data?.favorites || [];

            // Filter by selected date if needed
            if (selectedDate) {
              return favoriteMatches.filter((favorite) => {
                const matchDate = new Date(favorite.match_info?.starting_at)
                  .toISOString()
                  .split("T")[0];
                return matchDate === selectedDate;
              });
            }
            return favoriteMatches;
          })
          .catch((error) => {
            console.error(
              "Failed to fetch individual favorite matches:",
              error,
            );
            return [];
          }),
      );

      // Wait for both requests to complete
      const [teamMatchesResult, favoriteMatchesResult] =
        await Promise.all(promises);

      // Combine and deduplicate matches
      const allMatches = [...teamMatchesResult];
      const teamMatchIds = new Set(teamMatchesResult.map((m) => m.match_id));

      // Add individual favorites that aren't already included from team matches
      favoriteMatchesResult.forEach((favorite) => {
        if (!teamMatchIds.has(favorite.match_id)) {
          // Convert favorite format to match format
          allMatches.push({
            _id: favorite._id,
            match_id: favorite.match_id,
            match_info: favorite.match_info,
            teams: {
              home: favorite.match_info?.home_team,
              away: favorite.match_info?.away_team,
            },
            date: favorite.match_info?.starting_at,
            source: favorite.source || "manual",
          });
        }
      });

      console.log("Combined matches:", allMatches);
      setMatches(allMatches);
      setError(null);
    } catch (err) {
      console.error("Failed to fetch followed fixtures:", err);
      setError(`Failed to load fixtures: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleMatchRemoved = (matchId) => {
    setMatches(matches.filter((match) => match.match_id !== matchId));
  };

  const getFilteredMatches = () => {
    if (filter === "all") return matches;
    if (filter === "upcoming")
      return matches.filter((match) =>
        isUpcoming(match.match_info.starting_at),
      );
    if (filter === "past")
      return matches.filter(
        (match) => !isUpcoming(match.match_info.starting_at),
      );
    return matches;
  };

  const filteredMatches = getFilteredMatches();

  if (authLoading) {
    return (
      <div className="followed-fixtures-page">
        <div className="page-container">
          <div className="loading">Loading...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <div className="followed-fixtures-page">
          {/* Header Ad */}
          <AdSenseAd
            slot="5183171853"
            format="auto"
            className="adsense-header adsense-banner"
          />
          <PremiumBanner />

          <div className="page-container">
            <div className="auth-required">
              <h1>Sign In Required</h1>
              <p>You need to be signed in to view your followed fixtures.</p>
              <p>
                Once signed in, matches from your favorite and followed teams
                will automatically appear here.
              </p>
              <button
                // className="auth-required-btn"
                className="btn"
                onClick={() => setIsAuthModalOpen(true)}
              >
                Sign In
              </button>
            </div>
          </div>
        </div>

        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="followed-fixtures-page">
      <div className="page-container">
        <div className="page-header">
          <h1>⚽ Followed Fixtures</h1>
          <p>
            Your personalised football feed showing upcoming and live matches
            from your favorite team, followed clubs, and individually saved
            fixtures. Stay updated with kick-off times, results, and match
            information in one place.
          </p>
        </div>

        {/* Date Filter */}
        <div className="date-filter">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="date-input"
          />
          <button
            onClick={() => setSelectedDate("")}
            // className="clear-date-btn"
            className="btn"
          >
            Show All Dates
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="filter-tabs">
          <button
            className={filter === "all" ? "active" : ""}
            onClick={() => setFilter("all")}
          >
            All Fixtures
          </button>
          <button
            className={filter === "upcoming" ? "active" : ""}
            onClick={() => setFilter("upcoming")}
          >
            Upcoming
          </button>
          <button
            className={filter === "past" ? "active" : ""}
            onClick={() => setFilter("past")}
          >
            Past Fixtures
          </button>
        </div>

        {/* Inline Ad */}
        <AdSenseAd
          slot="8038180302"
          format="rectangle"
          className="adsense-inline adsense-medium-rectangle"
        />

        {/* Content */}
        <p className="page-meta">{matches.length} tracked fixtures</p>
        {loading ? (
          <div className="loading">Loading your followed fixtures...</div>
        ) : error ? (
          <div className="error">
            <h3>Error Loading Fixtures</h3>
            <p>{error}</p>
            <button onClick={fetchMatches} className="retry-btn">
              Try Again
            </button>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="no-fixtures">
            <h3>No Fixtures Found</h3>
            {filter === "all" ? (
              <div>
                <p>
                  You don't have any followed fixtures on this day. Either
                  change the filter settings or get started by following your
                  favorite teams or saving matches to build your personal
                  football feed.
                </p>
                <p>Fixtures will automatically appear here when you:</p>
                <ul>
                  <li>Set your favorite team in preferences</li>
                  <li>Follow additional teams</li>
                  <li>Manually favourite specific matches</li>
                  <li>Apply the right filter conditions</li>
                </ul>
                <a
                  href="/account/team-preferences"
                  className="preferences-link"
                >
                  Set Team Preferences
                </a>
              </div>
            ) : (
              <p>No {filter} fixtures found.</p>
            )}
          </div>
        ) : (
          <div className="fixtures-list">
            {filteredMatches.map((match) => (
              <div key={match._id} className="fixture-card">
                <div className="fixture-header">
                  <div className="fixture-source">
                    <span className="source-icon">
                      {match.source === "auto_favorite_team"
                        ? "⭐"
                        : match.source === "auto_followed_team"
                          ? "👁️"
                          : "💙"}
                    </span>
                    <span className="source-text">
                      {match.source === "auto_favorite_team"
                        ? "Favorite Team"
                        : match.source === "auto_followed_team"
                          ? "Followed Team"
                          : "Added Manually"}
                    </span>
                  </div>

                  <div className="fixture-favorite">
                    <FavoriteButton
                      matchId={match.match_id}
                      size="small"
                      onToggle={(isFavorited, action) => {
                        if (action === "removed") {
                          handleMatchRemoved(match.match_id);
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="fixture-teams">
                  <div className="home-team">
                    <span className="team-name">
                      {match.teams?.home?.team_name || "Home Team"}
                    </span>
                  </div>

                  <div className="fixture-vs">
                    <span>vs</span>
                  </div>

                  <div className="away-team">
                    <span className="team-name">
                      {match.teams?.away?.team_name || "Away Team"}
                    </span>
                  </div>
                </div>

                <div className="fixture-info">
                  <div className="fixture-datetime">
                    <span className="fixture-date">
                      {formatDate(match.match_info?.starting_at || match.date)}
                    </span>
                    <span className="fixture-time">
                      {formatTime(match.match_info?.starting_at || match.date)}
                    </span>
                  </div>

                  {match.match_info?.league?.name && (
                    <div className="fixture-league">
                      {match.match_info.league.name}
                    </div>
                  )}

                  {match.match_info?.venue?.name && (
                    <div className="fixture-venue">
                      📍 {match.match_info.venue.name}
                      {match.match_info.venue.city_name &&
                        `, ${match.match_info.venue.city_name}`}
                    </div>
                  )}

                  <div className="fixture-status">
                    <span
                      className={`status-badge ${isUpcoming(match.match_info?.starting_at || match.date) ? "upcoming" : "past"}`}
                    >
                      {isUpcoming(match.match_info?.starting_at || match.date)
                        ? "Upcoming"
                        : "Finished"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
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

export default FollowedFixtures;
