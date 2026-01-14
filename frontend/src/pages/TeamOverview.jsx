// src/pages/TeamOverview.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getLastMatchForTeam } from "../api";
import MatchInfoCard from "../components/MatchInfoCard/MatchInfoCard";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";
import NewsCard from "../components/NewsCard/NewsCard";


import arrow from "../assets/images/arrow-down-solid-full.svg";
import news from "../assets/images/newspaper-regular-full.svg";


import "./css/teamoverview.css";

// Transform function to convert full match data to expected format
const transformMatchToMatchInfo = (match, teamSlug) => {
  if (!match) return null;

  // More comprehensive team detection
  const homeTeam = match.teams?.home || {
    team_name: match.home_team || "Home Team",
    team_slug: match.home_team_slug || null,
  };
  const awayTeam = match.teams?.away || {
    team_name: match.away_team || "Away Team",
    team_slug: match.away_team_slug || null,
  };

  // Check multiple ways to identify if this is the home team
  const isHome =
    homeTeam.team_slug === teamSlug ||
    match.home_team_slug === teamSlug ||
    (homeTeam.team_name &&
      homeTeam.team_name.toLowerCase().replace(/\s+/g, "-") === teamSlug) ||
    (match.home_team &&
      match.home_team.toLowerCase().replace(/\s+/g, "-") === teamSlug);

  const opponentTeam = isHome ? awayTeam : homeTeam;
  const homeScore = match.score?.home ?? 0;
  const awayScore = match.score?.away ?? 0;

  const goalsFor = isHome ? homeScore : awayScore;
  const goalsAgainst = isHome ? awayScore : homeScore;

  // Determine win/loss/draw for finished matches
  let win = null;
  const matchStatus = (
    match.match_status?.state ||
    match.match_status?.developer_name ||
    match.status ||
    ""
  ).toLowerCase();
  const isFinished = [
    "ft",
    "finished",
    "ended",
    "full-time",
    "full time",
  ].includes(matchStatus);

  if (isFinished) {
    if (goalsFor > goalsAgainst) win = true;
    else if (goalsFor < goalsAgainst) win = false;
    else win = null; // draw
  }

  return {
    match_id: match.match_id,
    date: match.match_info?.starting_at || match.date,
    opponent_name:
      opponentTeam.team_name || opponentTeam.name || "Unknown Opponent",
    opponent_slug: opponentTeam.team_slug || null,
    home_game: isHome,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    win: win,
    status:
      match.match_status?.state ||
      match.match_status?.developer_name ||
      "unknown",
    league: match.match_info?.league || null,
    venue: match.match_info?.venue || null,
    score: match.score,
    is_live: ["live", "1H", "2H", "HT"].includes(match.match_status?.state),
    // Include full match data for advanced use cases
    _fullMatch: match,
  };
};

// eslint-disable-next-line no-unused-vars
const StatusBadge = ({ status }) => {
  // status may be an object (match.match_status) or a string
  const code = status?.developer_name ?? status?.state ?? status ?? "unknown";
  const cls = `status-badge status-${code}`;
  const label =
    code === "live"
      ? "LIVE"
      : code === "finished" || code === "FT"
      ? "FT"
      : "UPCOMING";
  return <span className={cls}>{label}</span>;
};

const TeamOverview = () => {
  const { teamSlug } = useParams(); // route should be /:teamSlug
  const [teamData, setTeamData] = useState(null);
  const [loadingTeam, setLoadingTeam] = useState(true);
  const [error, setError] = useState(null);
  const [match, setMatch] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [loadingMatch, setLoadingMatch] = useState(true);

  // Fetch team data using the team endpoint
  useEffect(() => {
    if (!teamSlug) return;

    const fetchTeamData = async () => {
      setLoadingTeam(true);
      setError(null);

      try {
        const response = await fetch(
          `${
            process.env.REACT_APP_API_BASE ||
            "https://virtuous-exploration-production.up.railway.app"
          }/api/teams/${encodeURIComponent(teamSlug)}`
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        setTeamData({ team: data });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingTeam(false);
      }
    };

    fetchTeamData();
  }, [teamSlug]);

  useEffect(() => {
    if (!teamSlug) return;
    setLoadingMatch(true);
    getLastMatchForTeam(teamSlug)
      .then(setMatch)
      .catch((err) => {
        // 404 is expected when no matches exist
        if (err.status === 404) setMatch(null);
        else
          console.warn(
            "Failed to fetch legacy match data:",
            err.body || err.message
          );
      })
      .finally(() => setLoadingMatch(false));
  }, [teamSlug]);

  // Extract team data and create match info from references
  const team = teamData?.team;
  const [lastMatch, setLastMatch] = useState(null);
  const [nextMatch, setNextMatch] = useState(null);

  // Fetch match details based on last_match and next_match IDs
  useEffect(() => {
    if (!team) return;

    const fetchMatches = async () => {
      const promises = [];

      // Fetch last match if ID exists
      if (team.last_match) {
        promises.push(
          fetch(
            `${
              process.env.REACT_APP_API_BASE ||
              "https://virtuous-exploration-production.up.railway.app"
            }/api/matches/${team.last_match}`
          )
            .then((res) => (res.ok ? res.json() : null))
            .then((match) => ({ type: "last", match }))
            .catch((err) => {
              console.warn("Last match fetch error:", err);
              return { type: "last", match: null };
            })
        );
      }

      // Fetch next match if ID exists
      if (team.next_match) {
        promises.push(
          fetch(
            `${
              process.env.REACT_APP_API_BASE ||
              "https://virtuous-exploration-production.up.railway.app"
            }/api/matches/${team.next_match}`
          )
            .then((res) => (res.ok ? res.json() : null))
            .then((match) => ({ type: "next", match }))
            .catch((err) => {
              console.warn("Next match fetch error:", err);
              return { type: "next", match: null };
            })
        );
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises);

        results.forEach(({ type, match }) => {
          if (match) {
            // Transform match to expected format
            const transformedMatch = transformMatchToMatchInfo(match, teamSlug);
            if (type === "last") {
              setLastMatch(transformedMatch);
            } else {
              setNextMatch(transformedMatch);
            }
          }
        });
      }
    };

    fetchMatches();
  }, [team, teamSlug]);

  if (!teamSlug) return <div>No team slug in URL</div>;
  if (error) return <div>Error: {String(error)}</div>;

  console.log("[match] JSON:", match);

  return (
    <div className="team-overview">
      {/* Header Ad */}
      <AdSenseAd
        slot="2345678901" // Replace with your actual ad slot ID
        format="auto"
        className="adsense-header adsense-banner"
      />
      <PremiumBanner />

      {loadingTeam ? (
        <p>Loading team...</p>
      ) : (
        <div className="team-overview-header">
          <h1>{team?.name || teamSlug}</h1>
          {team?.image_path && (
            <img src={team.image_path} alt={`${team.name} badge`} />
          )}
          <div></div>
        </div>
      )}

      <section className="team-matches">
        {/* Data freshness indicator
        {!loadingTeam && team && (
          <div className={`data-freshness current`}>
            ✅ Live data (reference-based)
            Show which approach is being used
            {process.env.NODE_ENV === 'development' && (
              <div style={{ fontSize: '0.8em', opacity: 0.7, marginTop: '4px' }}>
                Using: reference-based matches
                {team.last_match && ` (last: ${team.last_match})`}
                {team.next_match && ` (next: ${team.next_match})`}
              </div>
            )}
          </div>
        )} */}

        <div className="matches-grid">
          <div className="match-section">
            <h2>Last Match</h2>
            {loadingTeam ? (
              <div className="match-info-card empty">
                <p>Loading team data...</p>
              </div>
            ) : (
              <MatchInfoCard
                matchInfo={
                  lastMatch ||
                  (match ? transformMatchToMatchInfo(match, teamSlug) : null)
                }
                teamName={team?.name}
                teamSlug={teamSlug}
                type="last"
                showLinks={true}
              />
            )}
          </div>

          {/* Sidebar Ad */}
          <AdSenseAd
            slot="3456789012" // Replace with your actual ad slot ID
            format="rectangle"
            className="adsense-sidebar adsense-medium-rectangle"
          />

          <div className="match-section">
            <h2>Next Match</h2>
            {loadingTeam ? (
              <div className="match-info-card empty">
                <p>Loading team data...</p>
              </div>
            ) : (
              <MatchInfoCard
                matchInfo={nextMatch}
                teamName={team?.name}
                teamSlug={teamSlug}
                type="next"
                showLinks={true}
              />
            )}
          </div>
        </div>

        {/* Inline Ad after matches */}
        <AdSenseAd
          slot="4567890123" // Replace with your actual ad slot ID
          format="auto"
          className="adsense-inline adsense-leaderboard"
        />

        {/* Legacy match data section - keep for comparison during testing */}
        {/* {process.env.NODE_ENV === "development" && (
          <details style={{ marginTop: "30px", opacity: 0.6 }}>
            <summary style={{ cursor: "pointer", fontWeight: "bold" }}>
              🔧 Debug: Legacy Match Data
            </summary>
            <div
              style={{
                marginTop: "10px",
                padding: "10px",
                background: "#f8f9fa",
                borderRadius: "4px",
              }}
            >
              {loadingMatch && <p>Loading legacy match...</p>}
              {!loadingMatch && !match && (
                <p>No legacy match data available.</p>
              )}
              {match && (
                <div>
                  <p>
                    <strong>Legacy API result:</strong>
                    <br />
                    {new Date(match.date).toLocaleString()} — {match.home_team}{" "}
                    {match.score?.home ?? "-"} : {match.score?.away ?? "-"}{" "}
                    {match.away_team}
                  </p>
                </div>
              )}
            </div>
          </details>
        )} */}
        {/* <div>
          <div className="live-score-card-container">
            <div className="live-score-card">
              <div className="live-score-card-header">
                {match ? (
                  <StatusBadge status={match.match_status || match.status} />
                ) : null}
                <p>
                  {team?.last_match_info
                    ? team.last_match_info.home_game
                      ? team.name
                      : team.last_match_info.opponent_name
                    : "-"}
                  {" vs "}
                  {team?.last_match_info
                    ? team.last_match_info.home_game
                      ? team.last_match_info.opponent_name
                      : team.name
                    : "-"}


                </p>
              </div>

              
            </div>
          </div>
        </div> */}

        <div>
          <div className="news-section-header">
            <img className='news-icon' src={news} alt="News Icon" />
            <h2>Latest News</h2>
            <div>
              <a href="/">View all</a>
              <img src={arrow} alt="" />
            </div>
          </div>
          <NewsCard teamSlug={teamSlug} />
        </div>
      </section>
    </div>
  );
};

export default TeamOverview;
