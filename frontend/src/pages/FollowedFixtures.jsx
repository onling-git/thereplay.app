// src/pages/FollowedFixtures.jsx
import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { getTeamPreferences } from "../api/auth";
import { getFavoriteMatches } from "../api/favorites";
import { getTeamsByIds } from "../api";
import { API_BASE } from "../api/base";
import { toPublicTeamSlug } from "../utils/teamSlug";
import FavoriteButton from "../components/Favorites/FavoriteButton";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";
import AuthModal from "../components/Auth/AuthModal";
import "./css/followedFixtures.css";

const FollowedFixtures = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [followedTeams, setFollowedTeams] = useState([]);
  const [favoriteTeam, setFavoriteTeam] = useState(null);
  const [preferenceTeamNames, setPreferenceTeamNames] = useState([]);
  const [teamNamesError, setTeamNamesError] = useState(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [filter, setFilter] = useState("all");
  const [monthExpansion, setMonthExpansion] = useState(new Map());

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
      const ids = [...new Set([
        preferences.favourite_team, ...(preferences.followed_teams || []),
      ].filter((id) => id != null).map(String))];
      setPreferenceTeamNames([]);
      setTeamNamesError(null);
      if (ids.length > 0) {
        try {
          const teams = await getTeamsByIds(ids);
          setPreferenceTeamNames(ids.map((id) =>
            teams.find((team) => String(team.id) === id)?.name
          ).filter(Boolean));
        } catch (err) {
          console.error("Failed to load followed fixture team names:", err);
          setTeamNamesError("Team names could not be loaded.");
        }
      }
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

        const dateParam = selectedDate; // Always use the selected date
        const baseUrl = `${API_BASE}/api/matches/by-teams?teams=${allTeamIds.join(",")}&current_season=true`;
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
      const favoriteParams = { currentSeason: true };
      if (selectedDate) {
        // If a date is selected, we'll need to filter manually since the API doesn't support date filtering
        // For now, fetch all and filter client-side
      }

      promises.push(
        getFavoriteMatches(favoriteParams)
          .then((response) => {
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
            score: favorite.score,
            match_status: favorite.match_status,
            teams: favorite.teams || {
              home: favorite.match_info?.home_team,
              away: favorite.match_info?.away_team,
            },
            date: favorite.match_info?.starting_at,
            source: favorite.source || "manual",
          });
        }
      });

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
  const matchesByMonth = new Map();
  [...filteredMatches]
    .sort((a, b) => new Date(a.match_info?.starting_at || a.date) - new Date(b.match_info?.starting_at || b.date))
    .forEach((match) => {
      const date = new Date(match.match_info?.starting_at || match.date);
      const month = date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
      if (!matchesByMonth.has(month)) matchesByMonth.set(month, []);
      matchesByMonth.get(month).push(match);
    });

  const isMonthExpanded = (month, monthMatches) => {
    if (monthExpansion.has(month)) return monthExpansion.get(month);
    const date = new Date(monthMatches[0].match_info?.starting_at || monthMatches[0].date);
    const now = new Date();
    return date.getFullYear() * 12 + date.getMonth() >= now.getFullYear() * 12 + now.getMonth();
  };

  const toggleMonth = (month, monthMatches) => {
    setMonthExpansion((previous) => {
      const next = new Map(previous);
      next.set(month, !isMonthExpanded(month, monthMatches));
      return next;
    });
  };

  
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
          <h1>My Fixtures</h1>
          <p>
            Your personalised football feed showing upcoming and live matches
            from {preferenceTeamNames.length > 0
              ? new Intl.ListFormat("en-GB", { style: "long", type: "conjunction" }).format(preferenceTeamNames)
              : "your favourite and followed teams"}, plus individually saved
            fixtures. Stay updated with kick-off times, results, and match
            information in one place.
          </p>
          {teamNamesError && <p role="alert">{teamNamesError}</p>}
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
                  You don't have any followed fixtures{selectedDate ? " on this day" : ""}. Either
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
          <div className="followed-fixtures-container">
            {[...matchesByMonth].map(([month, monthMatches]) => (
              <section key={month} className="followed-fixtures-month" aria-label={month}>
                <h2 className="followed-fixtures-month-heading">
                  <button className="followed-fixtures-month-toggle"
                    aria-expanded={isMonthExpanded(month, monthMatches)}
                    onClick={() => toggleMonth(month, monthMatches)}>
                    <span>{month}</span>
                    <span className="followed-fixtures-month-count">
                      {monthMatches.length} {monthMatches.length === 1 ? "fixture" : "fixtures"}
                    </span>
                    <span className="followed-fixtures-month-arrow" aria-hidden="true">
                      {isMonthExpanded(month, monthMatches) ? "-" : "+"}
                    </span>
                  </button>
                </h2>
                {isMonthExpanded(month, monthMatches) && (
                  <div className="followed-fixtures-month-list">
                    {monthMatches.map((match) => {
                      const startingAt = match.match_info?.starting_at || match.date;
                      const status = match.match_status?.short_name;
                      const completed = ["FT", "AET", "PEN", "FT_PEN"].includes(status);
                      const hasScore = match.score?.home != null && match.score?.away != null;
                      const reportTeams = [match.teams?.home, match.teams?.away]
                        .filter((team) => team?.supported !== false && team?.has_report && team.team_slug);
                      const reportTeam = reportTeams.find((team) => String(team.team_id) === String(favoriteTeam))
                        || reportTeams.find((team) => followedTeams.some((id) => String(id) === String(team.team_id)))
                        || reportTeams[0];
                      return (
                        <div key={match.match_id} className="followed-fixtures-match">
                          <div className="followed-fixtures-match-timing">
                            <span>{completed ? status : formatTime(startingAt)}</span>
                            <span className="followed-fixtures-match-date">{formatDate(startingAt)}</span>
                          </div>
                          <div className="followed-fixtures-match-body">
                            <div className="followed-fixtures-match-teams">
                              {["home", "away"].map((side) => {
                                const team = match.teams?.[side];
                                const logo = team?.logo || team?.image_path;
                                const name = team?.team_name || (side === "home" ? "Home Team" : "Away Team");
                                return (
                                  <div key={side} className="followed-fixtures-team">
                                    {logo && <img className="followed-fixtures-team-logo" src={logo} alt="" />}
                                    {team?.team_slug && team?.supported !== false ? (
                                      <a className="followed-fixtures-team-link"
                                        href={`/${toPublicTeamSlug(team.team_slug, name)}/match/${match.match_id}/live`}>{name}</a>
                                    ) : <span>{name}</span>}
                                    {hasScore && status && status !== "NS" && (
                                      <span className="followed-fixtures-team-score">{match.score[side]}</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {match.source !== "auto_favorite_team" && match.source !== "auto_followed_team" && (
                              <div className="followed-fixtures-match-favorite">
                                <FavoriteButton matchId={match.match_id} initialFavorited size="small"
                                  onToggle={(isFavorited, action) => {
                                    if (action === "removed") handleMatchRemoved(match.match_id);
                                  }} />
                              </div>
                            )}
                          </div>
                          <div className="followed-fixtures-match-meta">
                            {/* <span>{match.source === "auto_favorite_team" ? "Favorite Team" :
                              match.source === "auto_followed_team" ? "Followed Team" : "Added Manually"}</span> */}
                            {/* <span>{status || (isUpcoming(startingAt) ? "Upcoming" : "Past fixture")}</span> */}
                            {completed && reportTeam && (
                              <a className="followed-fixtures-report-link"
                                href={`/${toPublicTeamSlug(reportTeam.team_slug, reportTeam.team_name)}/match/${match.match_id}/report`}>Match report</a>
                            )}
                            {completed && !reportTeam && <span>Report not available yet</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
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
