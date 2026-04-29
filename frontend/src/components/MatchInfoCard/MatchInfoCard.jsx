// src/components/MatchInfoCard/MatchInfoCard.jsx
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { getOpponentScout } from "../../api";
import "./MatchInfoCard.css";
import "../LiveScoreCards/livescorecards.css";

// Helper function to generate team slug from team name
const slugify = (str) => {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
};

const MatchInfoCard = ({
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

  console.log("this is the matchInfo data:", matchInfo);

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
      dateDisplay = matchDate.toLocaleDateString("en-US", { weekday: "long" });
    } else {
      // Show full date for dates beyond 3 days
      dateDisplay = matchDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    }
  }

  return (
    <div>
      <div className={`scorecard ${type} ${isLive ? "live" : ""} ${className}`}>
        <div className="scorecard-status">
          <span>{dateDisplay}</span>
          <span>
            {matchInfo.status === "FT"
              ? "FT"
              : matchInfo.status === "Live"
              ? matchInfo._fullMatch.match_status.minute
              : matchInfo.status === "HT"
              ? "HT"
              : timeDisplay}
          </span>

          {isLive && (
            <span className="live-indicator">
              {matchInfo._fullMatch?.match_status?.short_name ||
                matchInfo.status ||
                "LIVE"}
            </span>
          )}

        </div>
        <div className="to-scorecard-inner">
          <div className="scorecard-inner">
            <div className="scorecard-teams">
              <div>
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
              <div>
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
            <div className="scorecard-icon">
              <div>
                <p className="scorecard-score">{matchInfo.score.home}</p>
                <p className="scorecard-score">{matchInfo.score.away}</p>
              </div>
            </div>
          </div>
        </div>

        {/* <div className="match-overview"> */}
        {/* <div className="match-scores">
          <div className="match-team-name">
            <p>{matchInfo.home_game ? teamName : matchInfo.opponent_name}</p>
            <p>{matchInfo.home_game ? matchInfo.opponent_name : teamName}</p>
          </div>
          {isLastMatch || isLive ? (
            <div className="to-score">
              {isLive
                ? // Live match - show current score
                  matchInfo.home_game
                  ? `${matchInfo.score?.home || 0} - ${
                      matchInfo.score?.away || 0
                    }`
                  : `${matchInfo.score?.away || 0} - ${
                      matchInfo.score?.home || 0
                    }`
                : // Last match - show final score
                matchInfo.home_game
                ? `${matchInfo.goals_for} - ${matchInfo.goals_against}`
                : `${matchInfo.goals_against} - ${matchInfo.goals_for}`}
            </div>
          ) : (
            <span className="vs"> vs </span>
          )}
        </div> */}
      </div>
      <div className="team-match-details">
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
        </div>

        {showLinks && matchInfo.match_id && (
          <div className="match-links">
            <Link to={`/${teamSlug}/match/${matchInfo.match_id}/live`}>
              Live updates
            </Link>
            {isLastMatch && (
              <>
                <span className="separator"> • </span>
                <Link to={`/${teamSlug}/match/${matchInfo.match_id}/report`}>
                  Match report
                </Link>
              </>
            )}
          </div>
        )}

        {/* Opponent Scout Section */}
        {opponentScout && opponentScout.standings && (
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
        )}
      </div>
    </div>
  );
};

export default MatchInfoCard;
