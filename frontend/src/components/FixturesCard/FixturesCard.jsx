// src/components/MatchInfoCard/MatchInfoCard.jsx
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getOpponentScout } from "../../api";
import "./FixturesCard.css";
import "../LiveScoreCards/livescorecards.css";

// Helper function to generate team slug from team name
const slugify = (str) => {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

const FixturesCard = ({
  matchInfo,
  teamName,
  teamSlug,
  type = "last", // 'last' or 'next'
  showLinks = true,
  className = "",
}) => {
  const [opponentScout, setOpponentScout] = useState(null);
  const [loadingScout, setLoadingScout] = useState(false);

  // Fetch opponent scout data
  useEffect(() => {
    if (!matchInfo?.match_id || !teamSlug) return;

    const fetchOpponentScout = async () => {
      setLoadingScout(true);
      try {
        const scoutData = await getOpponentScout(teamSlug, matchInfo.match_id);
        setOpponentScout(scoutData);
      } catch (error) {
        console.error("Failed to fetch opponent scout:", error);
        setOpponentScout(null);
      } finally {
        setLoadingScout(false);
      }
    };

    fetchOpponentScout();
  }, [matchInfo?.match_id, teamSlug]);

  if (!matchInfo) {
    return (
      <div className={`match-info-card empty ${className}`}>
        <p>
          No {type === "last" ? "recent" : "upcoming"} match data available.
        </p>
      </div>
    );
  }

  // console.log("this is the matchInfo data:", matchInfo);

  const isLastMatch = type === "last";
  const isLive =
    matchInfo.is_live ||
    ["live", "1H", "2H", "HT"].includes(matchInfo.status) ||
    ["live", "1H", "2H", "HT"].includes(
      matchInfo._fullMatch?.match_status?.state
    );
  const matchDate = new Date(matchInfo.date);
  const now = new Date();
  const isToday = matchDate.toDateString() === now.toDateString();
  const isTomorrow =
    matchDate.toDateString() ===
    new Date(now.getTime() + 24 * 60 * 60 * 1000).toDateString();

  // Calculate days difference for within 3 days check
  const daysDiff = Math.floor((matchDate - now) / (1000 * 60 * 60 * 24));
  const isWithin3Days = Math.abs(daysDiff) <= 3;

  // Get team slugs for links
  const opponentSlug = matchInfo.opponent_slug || slugify(matchInfo.opponent_name);
  const matchId = matchInfo.match_id;

  // Format date and time separately
  let dateDisplay, timeDisplay;

  if (isLive) {
    dateDisplay = "LIVE";
    timeDisplay = matchInfo.match_info?.minute
      ? `${matchInfo.match_info.minute}'`
      : "";
  } else {
    // Format time as HH:MM in local time
    timeDisplay = matchDate.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    // Format date
    if (isToday) {
      dateDisplay = "Today";
    } else if (isTomorrow && !isLastMatch) {
      dateDisplay = "Tomorrow";
    } else if (isWithin3Days) {
      // Show day of week for dates within 3 days
      dateDisplay = matchDate.toLocaleDateString("en-GB", { weekday: "long" });
    } else {
      // Show full date for dates beyond 3 days
      dateDisplay = matchDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",

      });
    }
  }

  return (

    <div>

      <div className="fixtures-card-body">

        <div className="fixture-details">
          <div className="fixture-details-left">
            <div className="fixture-date-time">
              <span className="fixture-match-time">
                {matchInfo.status === "FT"
                  ? "FT"
                  : matchInfo.status === "Live"
                    ? matchInfo._fullMatch.match_status.minute
                    : matchInfo.status === "HT"
                      ? "HT"
                      : timeDisplay}
              </span>
              <span className="fixture-match-date">{dateDisplay}</span>
            </div>
            <div className="fixture-card-teams">
              <div className="fixture-team-info">
                <img
                  src={matchInfo.home_game ? matchInfo.team_logo : matchInfo.opponent_logo}
                  alt={matchInfo.home_game ? matchInfo.team_name : matchInfo.opponent_name}
                />
                <div className="fixture-team-name">
                  {matchInfo.home_game ? (
                    <Link to={`/${teamSlug}/match/${matchId}/live`} className="team-name-link">
                      <p>{teamName}</p>
                    </Link>
                  ) : (
                    <Link to={`/${opponentSlug}/match/${matchId}/live`} className="team-name-link">
                      <p>{matchInfo.opponent_name}</p>
                    </Link>
                  )}
                </div>
              </div>

              <div className="fixture-team-info">
                <img
                  src={matchInfo.home_game ? matchInfo.opponent_logo : matchInfo.team_logo}
                  alt={matchInfo.home_game ? matchInfo.opponent_name : matchInfo.team_name}
                />

                <div className="fixture-team-name">
                  {matchInfo.home_game ? (
                    <Link to={`/${opponentSlug}/match/${matchId}/live`} className="team-name-link">
                      <p>{matchInfo.opponent_name}</p>
                    </Link>
                  ) : (
                    <Link to={`/${teamSlug}/match/${matchId}/live`} className="team-name-link">
                      <p>{teamName}</p>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>

            {showLinks && matchInfo.match_id && (
              <div className="fixture-card-match-links">

                <Link to={`/${teamSlug}/match/${matchInfo.match_id}/live`}>
                  Live updates
                </Link>
                {isLastMatch && (
                  <>

                    <Link to={`/${teamSlug}/match/${matchInfo.match_id}/report`}>
                      Match report
                    </Link>
                  </>
                )}
              </div>
            )}
   
        </div>
      </div>
      {/* <div className="fixtures-card-header">


        <div>
          <div className="fixtures-card-badge">
            <img
              src={matchInfo.home_game ? matchInfo.team_logo : matchInfo.opponent_logo}
              alt={matchInfo.home_game ? matchInfo.team_name : matchInfo.opponent_name}
            />
          </div>
          <div className="match-info-team-name">
            {matchInfo.home_game ? (
              <Link to={`/${teamSlug}/match/${matchId}/live`} className="team-name-link">
                <p>{teamName}</p>
              </Link>
            ) : (
              <Link to={`/${opponentSlug}/match/${matchId}/live`} className="team-name-link">
                <p>{matchInfo.opponent_name}</p>
              </Link>
            )}
          </div>
        </div>


        <div>


        </div>

        <div>
          <div className="match-team-info-badge right">
            <img
              src={matchInfo.home_game ? matchInfo.opponent_logo : matchInfo.team_logo}
              alt={matchInfo.home_game ? matchInfo.opponent_name : matchInfo.team_name}
            />
          </div>
          <div className="match-info-team-name">
            {matchInfo.home_game ? (
              <Link to={`/${opponentSlug}/match/${matchId}/live`} className="team-name-link">
                <p>{matchInfo.opponent_name}</p>
              </Link>
            ) : (
              <Link to={`/${teamSlug}/match/${matchId}/live`} className="team-name-link">
                <p>{teamName}</p>
              </Link>
            )}
          </div>
        </div>

      </div>

      <div className="match-detail-container">

        <div className="match-details">
          <div className="result-details">
            {isLastMatch && (
              <span className="result">
                {matchInfo.win === true && <span className="win">🏆 Win</span>}
                {matchInfo.win === false && <span className="loss">😞 Loss</span>}
                {matchInfo.win === null && <span className="draw">🤝 Draw</span>}
                <span className="separator"> • </span>
              </span>

            )}
            <span className={`venue ${matchInfo.home_game ? "home" : "away"}`}>
              {matchInfo.home_game ? "🏠 Home" : "✈️ Away"}
            </span>
            <span className="separator"> • </span>
            <span>
              {matchInfo?.venue?.city_name}
            </span>
            <span className="separator"> • </span>
            <span>
              {matchInfo?.league?.name}
            </span>
            <span className="separator"> • </span>
            <span>
              {`Matchweek ${matchInfo?._fullMatch?.match_info?.round?.name}`}
            </span>
          </div> */}




      {/* </div> */}



      {/* </div> */}

      {/* Opponent Scout Section */}
      {/* {opponentScout && opponentScout.standings && (
        <div className="opponent-scout">
          <div className="scout-header">Opponent Scout</div>
          <div className="scout-row">
            <div className="scout-info">
              <span>#{opponentScout.standings.position}</span>
              <span>{opponentScout.standings.points}pts</span>
              <span>{opponentScout.standings.won}W-{opponentScout.standings.drawn}D-{opponentScout.standings.lost}L</span>
            </div>
            {opponentScout.standings.form && opponentScout.standings.form.length > 0 && (
              <div className="form-display">
                {opponentScout.standings.form.slice(0, 5).map((result, index) => (
                  <span
                    key={index}
                    className={`form-badge form-${result.toLowerCase()}`}
                    title={result === 'W' ? 'Win' : result === 'D' ? 'Draw' : 'Loss'}
                  >
                    {result}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {loadingScout && (
        <div className="opponent-scout loading">
          <p>Loading opponent information...</p>
        </div>
      )} */}
    </div>
  );
};

export default FixturesCard;
