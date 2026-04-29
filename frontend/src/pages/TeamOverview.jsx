// src/pages/TeamOverview.jsx
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getLastMatchForTeam, getTeamStandings, getTeamCompetitions } from "../api";
import MatchInfoCard from "../components/MatchInfoCard/MatchInfoCard";
import StandingsPositionCard from "../components/StandingsPositionCard/StandingsPositionCard";
import CompetitionsCard from "../components/CompetitionsCard/CompetitionsCard";
import StandingsModal from "../components/StandingsModal/StandingsModal";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";
import NewsCard from "../components/NewsCard/NewsCard";
import TeamTweetsCard from "../components/TeamTweetsCard/TeamTweetsCard";


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
  const [standings, setStandings] = useState([]);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [competitions, setCompetitions] = useState([]);
  const [loadingCompetitions, setLoadingCompetitions] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [hasTweets, setHasTweets] = useState(false);

  // Scroll to top when navigating to this page
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [teamSlug]);

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

  // Fetch standings when team data is available
  useEffect(() => {
    if (!team?.id) {
      console.log('[standings] No team.id available yet');
      return;
    }

    console.log('[standings] Fetching standings for team.id:', team.id);

    const fetchStandings = async () => {
      setLoadingStandings(true);
      try {
        const response = await getTeamStandings(team.id);
        console.log('[standings] Received response:', response);
        // Backend returns { ok: true, data: standings }
        setStandings(response?.data || []);
      } catch (err) {
        console.warn("Failed to fetch standings:", err);
        setStandings([]);
      } finally {
        setLoadingStandings(false);
      }
    };

    fetchStandings();
  }, [team?.id]);

  // Fetch competitions when team slug is available
  useEffect(() => {
    if (!teamSlug) {
      return;
    }

    const fetchCompetitions = async () => {
      setLoadingCompetitions(true);
      try {
        const response = await getTeamCompetitions(teamSlug);
        console.log('[competitions] Received response:', response);
        // Backend returns { ok: true, competitions: [...] }
        setCompetitions(response?.competitions || []);
      } catch (err) {
        console.warn("Failed to fetch competitions:", err);
        setCompetitions([]);
      } finally {
        setLoadingCompetitions(false);
      }
    };

    fetchCompetitions();
  }, [teamSlug]);

  // Check if tweets are available
  useEffect(() => {
    if (!teamSlug) return;

    const checkTweets = async () => {
      try {
        const response = await fetch(
          `${
            process.env.REACT_APP_API_BASE ||
            "https://virtuous-exploration-production.up.railway.app"
          }/api/tweets/team/${encodeURIComponent(teamSlug)}?feedType=team_feed&limit=1`
        );

        if (!response.ok) {
          setHasTweets(false);
          return;
        }

        const data = await response.json();
        setHasTweets(data.tweets && data.tweets.length > 0);
      } catch (err) {
        console.warn("Failed to check tweets:", err);
        setHasTweets(false);
      }
    };

    checkTweets();
  }, [teamSlug]);

  if (!teamSlug) return <div>No team slug in URL</div>;
  if (error) return <div>Error: {String(error)}</div>;

  console.log("[match] JSON:", match);

  return (
    <div className="team-overview">
      {/* Header Ad */}
      <AdSenseAd
        slot="5183171853"
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
        {/* Dashboard Grid */}
        <div className="dashboard-grid">
          <div className="dashboard-card">
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

          <div className="dashboard-card">
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

          {!loadingStandings && standings && standings.length > 0 && (
            <div className="dashboard-card">
              <h2>League Position</h2>
              <StandingsPositionCard
                standings={standings}
                teamId={team?.id}
                teamName={team?.name}
                teamImage={team?.image_path}
                onViewTable={() => setIsModalOpen(true)}
              />
            </div>
          )}

          {!loadingCompetitions && competitions && competitions.filter(c => c.is_still_participating).length > 0 && (
            <div className="dashboard-card">
              <h2>Other Competitions</h2>
              <CompetitionsCard
                competitions={competitions}
                teamName={team?.name}
              />
            </div>
          )}

          {/* Team Tweets Section - tall scrollable card - only show if tweets available */}
          {hasTweets && (
            <div className="dashboard-card dashboard-card-tall">
              <h2>
                <svg viewBox="0 0 24 24" fill="currentColor" style={{width: '18px', height: '18px', display: 'inline-block', marginRight: '8px', verticalAlign: 'middle'}}>
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path>
                </svg>
                Fan Reactions
              </h2>
              <div className="tweets-scroll-container">
                <TeamTweetsCard teamSlug={teamSlug} maxTweets={20} />
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Ad */}
        <AdSenseAd
          slot="3276027966"
          format="rectangle"
          className="adsense-sidebar adsense-medium-rectangle"
        />

        {/* Inline Ad after matches */}
        <AdSenseAd
          slot="8038180302"
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

      {/* Standings Modal */}
      <StandingsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        standings={standings}
        currentTeamId={team?.id}
      />
    </div>
  );
};

export default TeamOverview;
