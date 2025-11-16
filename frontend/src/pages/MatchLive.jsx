// src/pages/MatchLive.jsx
import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import useSSE from "../hooks/useSSE";
import { sseMatchUrl, getMatch, getTeamSnapshot } from "../api";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";
import "./css/matchLive.css";

import goalIcon from '../assets/images/ball-icon.svg'
import eventIcon from '../assets/images/whistle-icon.svg'

export default function MatchLive() {
  const { matchId, teamSlug } = useParams(); // route: /:teamSlug/match/:matchId/live
  const url = sseMatchUrl(matchId);
  const { data: sseData, status } = useSSE(url, { retryMs: 6000 });
  const [matchSnapshot, setMatchSnapshot] = useState(null);
  const [error, setError] = useState(null);
  const [follow, setFollow] = useState(true);
  const [teamData, setTeamData] = useState({ home: null, away: null });

  console.log("THIS IS TE URL: ", matchSnapshot);

  // Determine if teamSlug is home or away team
  const getTeamSide = (matchData, slug) => {
    if (!matchData?.teams) return null;
    if (matchData.teams.home?.team_slug === slug) return "home";
    if (matchData.teams.away?.team_slug === slug) return "away";
    return null;
  };

  const teamSide = getTeamSide(matchSnapshot, teamSlug);
  const isHomeTeam = teamSide === "home";
  const isAwayTeam = teamSide === "away";
  const eventsEndRef = useRef(null);
  const prevEventsRef = useRef(new Set());
  const newEventIdsRef = useRef(new Set());
  const prevCommentKeysRef = useRef(new Set());
  const newCommentKeysRef = useRef(new Set());

  // helper: check if event should be displayed (goals and red cards only)
  const isKeyEvent = (event) => {
    const eventType = String(event.type || "").toLowerCase();
    return (
      eventType.includes("goal") ||
      eventType.includes("owngoal") ||
      eventType.includes("own_goal") ||
      eventType.includes("redcard") ||
      eventType.includes("red_card") ||
      eventType.includes("red card")
    );
  };

  // helper: get event icon based on event type
  const getEventIcon = (type) => {
    const eventType = String(type || "").toLowerCase();
    if (eventType.includes("goal")) return "⚽";
    if (eventType.includes("owngoal") || eventType.includes("own_goal"))
      return "⚽";
    if (
      eventType.includes("redcard") ||
      eventType.includes("red_card") ||
      eventType.includes("red card")
    )
      return "🟥";
    return "•";
  };

  // helper: determine if event belongs to a team
  const isEventForTeam = (event, teamSide) => {
    // First check if team field is populated (preferred method)
    if (event.team) {
      return event.team === teamSide;
    }

    // Fallback: use participant_id to determine team
    if (event.participant_id && matchSnapshot.teams) {
      const homeTeamId = matchSnapshot.teams.home?.team_id;
      const awayTeamId = matchSnapshot.teams.away?.team_id;

      if (
        teamSide === "home" &&
        homeTeamId &&
        String(event.participant_id) === String(homeTeamId)
      ) {
        return true;
      }
      if (
        teamSide === "away" &&
        awayTeamId &&
        String(event.participant_id) === String(awayTeamId)
      ) {
        return true;
      }
    }

    return false;
  };

  // helper: render team events (only goals and red cards)
  const renderTeamEvents = (teamSide, maxEvents = 5) => {
    const teamEvents = sortEventsByMinute(matchSnapshot.events || [])
      .filter((e) => isEventForTeam(e, teamSide) && isKeyEvent(e))
      .slice(0, maxEvents);

    if (teamEvents.length === 0) {
      return <p></p>;
    }

    return teamEvents.map((e, i) => {
      const eventType = String(e.type || "").toLowerCase();
      const isGoal = eventType.includes("goal");
      const isRedCard =
        eventType.includes("redcard") ||
        eventType.includes("red_card") ||
        eventType.includes("red card");

      return (
        <p key={i}>
          {e.player_name && <span>{e.player_name}</span>} (
          <span>{e.minute && `${e.minute}'`}</span>){" "}
          {/* <span>{e.type}</span>{" "} */}
          <span>{getEventIcon(e.type)}</span>
        </p>
      );
    });
  };

  // helper: return a new array of events sorted by minute (ascending)
  const sortEventsByMinute = (events) => {
    if (!Array.isArray(events)) return [];
    const evMinute = (e) => {
      if (e == null || e.minute == null || e.minute === "")
        return Number.POSITIVE_INFINITY;
      const n = parseInt(String(e.minute), 10);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    };
    // stable-ish sort by creating index tie-breaker
    return events
      .map((ev, idx) => ({ ev, idx, m: evMinute(ev) }))
      .sort((a, b) => a.m - b.m || a.idx - b.idx)
      .map((x) => x.ev);
  };

  // helper: return comments sorted by `order` (ascending). Accepts array or undefined
  const sortCommentsByOrder = (comments) => {
    if (!Array.isArray(comments)) return [];
    // sort descending so latest / highest `order` appear first
    return [...comments].sort((a, b) => {
      const oa = Number(a?.order ?? a?.minute ?? 0);
      const ob = Number(b?.order ?? b?.minute ?? 0);
      return ob - oa;
    });
  };

  // initial fetch (populate UI quickly)
  useEffect(() => {
    getMatch(teamSlug, matchId)
      .then(setMatchSnapshot)
      .catch((err) =>
        setError(err.body || err.message || "Failed to fetch match")
      );
  }, [teamSlug, matchId]);

  // Fetch team data when match snapshot is available
  useEffect(() => {
    if (!matchSnapshot?.teams) return;

    const fetchTeamData = async () => {
      try {
        const promises = [];

        // Fetch home team data if available
        if (matchSnapshot.teams.home?.team_slug) {
          promises.push(
            getTeamSnapshot(matchSnapshot.teams.home.team_slug)
              .then((data) => ({ side: "home", data }))
              .catch(() => ({ side: "home", data: null }))
          );
        }

        // Fetch away team data if available
        if (matchSnapshot.teams.away?.team_slug) {
          promises.push(
            getTeamSnapshot(matchSnapshot.teams.away.team_slug)
              .then((data) => ({ side: "away", data }))
              .catch(() => ({ side: "away", data: null }))
          );
        }

        const results = await Promise.all(promises);

        setTeamData((prev) => {
          const updated = { ...prev };
          results.forEach((result) => {
            updated[result.side] = result.data;
          });
          return updated;
        });
      } catch (error) {
        console.error("Error fetching team data:", error);
      }
    };

    fetchTeamData();
  }, [matchSnapshot?.teams]);

  // When SSE gives data, merge/update UI
  useEffect(() => {
    if (!sseData) return;
    // sseData expected to be full match doc or partial diff; merge intelligently
    setMatchSnapshot((prev) => {
      if (!prev) {
        // initialize prevEventsRef to current events
        const evs = Array.isArray(sseData.events) ? sseData.events : [];
        prevEventsRef.current = new Set(
          evs.map(
            (e) =>
              `${e.minute || ""}|${e.type || ""}|${e.player || ""}|${
                e.info || ""
              }`
          )
        );
        return sseData;
      }

      const next = { ...prev };

      // update top-level simple fields
      if (sseData.score) next.score = sseData.score;
      if (sseData.match_status) next.match_status = sseData.match_status;
      if (sseData.minute != null) next.minute = sseData.minute;
      if (sseData.match_info && sseData.match_info.starting_at)
        next.match_info = { ...next.match_info, ...sseData.match_info };

      // merge events: append any events that are new
      if (Array.isArray(sseData.events) && sseData.events.length) {
        const existing = Array.isArray(next.events) ? [...next.events] : [];
        for (const ev of sseData.events) {
          const id = `${ev.minute || ""}|${ev.type || ""}|${ev.player || ""}|${
            ev.info || ""
          }`;
          if (!prevEventsRef.current.has(id)) {
            existing.push(ev);
            prevEventsRef.current.add(id);
            newEventIdsRef.current.add(id);
          }
        }
        next.events = existing;
      }

      // merge comments: append/replace incoming comments and mark new ones
      if (Array.isArray(sseData.comments) && sseData.comments.length) {
        const existingComments = Array.isArray(next.comments)
          ? [...next.comments]
          : [];
        // key strategy: prefer `order` if present, then provider id fields, then text+minute
        const keyFor = (c) => {
          if (!c) return null;
          if (c.order != null) return `order:${String(c.order)}`;
          if (c.comment_id != null || c.id != null)
            return `id:${c.comment_id || c.id}`;
          return `text:${String(c.comment || c.comment_text || "").slice(
            0,
            200
          )}|m:${c.minute || 0}`;
        };

        // build map of existing comments keyed similarly so incoming can override
        const cmap = new Map();
        for (const c of existingComments) {
          const k = keyFor(c) || `gen:existing:${cmap.size}`;
          if (!cmap.has(k)) cmap.set(k, c);
        }
        for (const c of sseData.comments) {
          const k = keyFor(c) || `gen:incoming:${cmap.size}`;
          // incoming wins
          cmap.set(k, c);
          if (!prevCommentKeysRef.current.has(k)) {
            newCommentKeysRef.current.add(k);
          }
        }
        const merged = Array.from(cmap.values());
        // sort descending by `order` (fallback to minute) so latest comments are at the top
        merged.sort(
          (a, b) =>
            Number(b.order ?? b.minute ?? 0) - Number(a.order ?? a.minute ?? 0)
        );
        next.comments = merged;
        // ensure prevCommentKeysRef contains existing keys for subsequent diffs
        prevCommentKeysRef.current = new Set(Array.from(cmap.keys()));
      }

      // merge lineup/ratings if present
      if (sseData.lineup) next.lineup = sseData.lineup;
      if (sseData.player_ratings) next.player_ratings = sseData.player_ratings;

      return next;
    });
  }, [sseData]);

  // Poll fallback when SSE status is error for a short period
  useEffect(() => {
    if (status !== "error") return;
    let mounted = true;
    const poll = async () => {
      try {
        const fresh = await getMatch(teamSlug, matchId);
        if (mounted) setMatchSnapshot(fresh);
      } catch (e) {
        // ignore transient errors
      } finally {
        if (mounted) setTimeout(poll, 8000);
      }
    };
    poll();
    return () => {
      mounted = false;
    };
  }, [status, teamSlug, matchId]);

  useEffect(() => {
  const flashingEls = document.querySelectorAll(".goal-flash");
  flashingEls.forEach((el) => {
    el.addEventListener(
      "animationend",
      () => el.classList.remove("goal-flash"),
      { once: true }
    );
  });
});


  // helper to scroll to bottom when new events arrive and follow is true
  useEffect(() => {
    if (!follow) return;
    if (!eventsEndRef.current) return;
    // small timeout to allow DOM update
    const t = setTimeout(() => {
      try {
        eventsEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      } catch (e) {}
    }, 80);
    return () => clearTimeout(t);
  }, [matchSnapshot?.events, follow]);

  if (error) return <div>Error: {String(error)}</div>;
  if (!matchSnapshot || !matchSnapshot.teams)
    return <div>Loading match… SSE status: {status}</div>;

  return (
    <div className="match-live">
      {/* Header Ad */}
      <AdSenseAd
        slot="5678901234" // Replace with your actual ad slot ID
        format="auto"
        className="adsense-header adsense-banner"
      />
      <PremiumBanner />
      {/* <div className="match-info">
        <div className="teams">
          <div className="team-details">
            <div className="scores">
              <div className="team-name">
                <img
                  className="team-logo"
                  src={teamData.home?.image_path}
                  alt={matchSnapshot.teams.home?.team_name || "Home"}
                />
                <h2>{matchSnapshot.teams.home?.team_name ?? "Home"}</h2>
              </div>
              <div className="score">
                <h2>{matchSnapshot.score?.home ?? "-"}</h2>
              </div>
            </div>
            <div>{renderTeamEvents("home")}</div>
          </div>
          <div className="team-details">
            <div className="scores">
              <div className="team-name">
                <img
                  className="team-logo"
                  src={teamData.away?.image_path}
                  alt={matchSnapshot.teams.away?.team_name || "Away"}
                />
                <h2>{matchSnapshot.teams.away?.team_name ?? "Away"}</h2>
              </div>
              <div className="score">
                <h2>{matchSnapshot.score?.away ?? "-"}</h2>
              </div>
            </div>
            <div>{renderTeamEvents("away")}</div>
          </div>
        </div>
      </div> */}
      <div className="match-info">
        <div className="scorebox">
          <div className="home-team">
            <div className="score">
              <h2>{matchSnapshot.score?.home ?? "-"}</h2>
              <img
                className="home-badge"
                src={teamData.home?.image_path}
                alt={matchSnapshot.teams.home?.team_name || "Home"}
              />
            </div>
            <div>
              <p className="team-name">
                {matchSnapshot.teams.home?.team_name ?? "Home"}
              </p>
            </div>
            <div>
              <div className="home-events">{renderTeamEvents("home")}</div>
            </div>
          </div>
          <div>
            <div className="score-div">
              <h2>-</h2>
            </div>
          </div>
          <div className="away-team">
            <div className="score">
              <h2>{matchSnapshot.score?.away ?? "-"}</h2>
              <img
                className="away-badge"
                src={teamData.away?.image_path}
                alt={matchSnapshot.teams.away?.team_name || "Away"}
              />
            </div>
            <div>
              <p className="team-name">
                {matchSnapshot.teams.away?.team_name ?? "Away"}
              </p>
            </div>
            <div>
              <div className="away-events">{renderTeamEvents("away")}</div>
            </div>
          </div>
        </div>
      </div>
      {/* Inline Ad between match info and other content */}
      <AdSenseAd
        slot="6789012345" // Replace with your actual ad slot ID
        format="rectangle"
        className="adsense-inline adsense-medium-rectangle"
      />
      {/* Footer Ad */}
      <AdSenseAd
        slot="7890123456" // Replace with your actual ad slot ID
        format="auto"
        className="adsense-footer adsense-leaderboard"
      />
      {/* <p style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span>
          SSE: <strong>{status}</strong>
        </span>
        {status === "complete" && (
          <span
            style={{
              background: "#e6f7ff",
              color: "#055160",
              border: "1px solid #bfeefc",
              padding: "4px 8px",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Final result
          </span>
        )}
        {teamSide && (
          <span
            style={{
              background: isHomeTeam ? "#f0f9ff" : "#fefce8",
              color: isHomeTeam ? "#0c4a6e" : "#a16207",
              border: isHomeTeam ? "1px solid #bae6fd" : "1px solid #fde047",
              padding: "4px 8px",
              borderRadius: 6,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            {isHomeTeam ? "🏠 Home" : "✈️ Away"}
          </span>
        )}
        <span>
          {" "}
          Status:{" "}
          {matchSnapshot.match_status?.short_name ||
            matchSnapshot.status ||
            "n/a"}
        </span>
        <span> minute: {matchSnapshot.minute ?? "—"}</span>
      </p>

      <div style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 14 }}>
          <input
            type="checkbox"
            checked={follow}
            onChange={() => setFollow((v) => !v)}
          />{" "}
          Follow events
        </label>
      </div>
      <h3>Events</h3>
      <ul
        style={{
          maxHeight: 300,
          overflow: "auto",
          padding: 8,
          border: "1px solid #ddd",
        }}
      > 
        {sortEventsByMinute(matchSnapshot.events || []).map((e, i) => {
          const id = `${e.minute || ""}|${e.type || ""}|${e.player || ""}|${
            e.info || ""
          }`;
          const isNew = newEventIdsRef.current.has(id);
          return (
            <li
              key={i}
              style={{
                padding: "6px 4px",
                background: isNew ? "rgba(255,250,200,0.9)" : "transparent",
                transition: "background 400ms",
              }}
            >
              <strong>{e.minute ?? ""}'</strong> {e.type || ""} {e.player || ""}{" "}
              {e.result || ""} {e.info || ""}
            </li>
          );
        })}
        <div ref={eventsEndRef} />
      </ul>
*/}

      <ul className="comments-list">
        {sortCommentsByOrder(matchSnapshot.comments || []).map((c, i) => {
          const key =
            (c &&
              (c.order != null
                ? `order:${String(c.order)}`
                : c.comment_id || c.id
                ? `id:${c.comment_id || c.id}`
                : `text:${String(c.comment || c.comment_text || "").slice(
                    0,
                    200
                  )}|m:${c.minute || 0}`)) ||
            `c:${i}`;

          const isNew = newCommentKeysRef.current.has(key);

          // Determine comment class based on properties
          let commentClass = "standard-comment";
          if (c.is_goal === true) {
            commentClass = "goal-comment";
          } else if (c.is_important === true) {
            commentClass = "important-comment";
          }

          // Fuzzy match events with comments for goal and important comments (temporarily include ALL comments for debugging)
          let matchingEvent = null;
          if (
            (c.is_goal === true || c.is_important === true || (c.minute >= 60 && c.minute <= 65)) &&
            c.minute != null &&
            matchSnapshot.events
          ) {
            const commentText = (c.comment || "").toLowerCase();
            const commentMinute = c.minute;
            
            // Debug logging for specific cases (expanded range)
            if (commentText.includes('gavin') || commentText.includes('bazunu') || (commentMinute >= 60 && commentMinute <= 65)) {
              console.log('DEBUG - Comment:', {
                minute: commentMinute,
                text: commentText,
                is_goal: c.is_goal,
                is_important: c.is_important
              });
            }
            
            // Define keyword mappings for event types
            const eventKeywords = {
              'GOAL': ['goal', 'scored', 'scores', 'scoring', 'finish', 'shot'],
              'YELLOW_CARD': ['yellow', 'booked', 'caution', 'warned'],
              'YELLOWCARD': ['yellow', 'booked', 'caution', 'warned'], // Handle both formats
              'RED_CARD': ['red', 'dismissed', 'sent off', 'ejected'],
              'REDCARD': ['red', 'dismissed', 'sent off', 'ejected'], // Handle both formats
              'SUBSTITUTION': ['substitute', 'sub', 'replaced', 'comes on', 'off for'],
              'FOUL': ['foul', 'fouled', 'challenge', 'tackle']
            };
            
            // Find events within ±3 minutes of the comment
            const nearbyEvents = matchSnapshot.events.filter(event => 
              Math.abs((event.minute || 0) - commentMinute) <= 3
            );
            
            // Debug nearby events for Gavin Bazunu case (expanded range)
            if (commentText.includes('gavin') || commentText.includes('bazunu') || (commentMinute >= 60 && commentMinute <= 65)) {
              console.log('DEBUG - Nearby events:', nearbyEvents.map(e => ({
                minute: e.minute,
                type: e.type,
                player: e.player || e.player_name
              })));
            }
            
            // Score events based on keyword matching, player name, and minute proximity
            const scoredEvents = nearbyEvents.map(event => {
              let score = 0;
              let debugInfo = {};
              
              // Keyword matching score (highest priority)
              const eventType = event.type || '';
              const keywords = eventKeywords[eventType] || [];
              
              // Check if any keywords match the comment text
              const keywordMatches = keywords.filter(keyword => 
                commentText.includes(keyword)
              ).length;
              
              if (keywordMatches > 0) {
                score += keywordMatches * 100; // Very high bonus for keyword matches
                debugInfo.keywordScore = keywordMatches * 100;
                debugInfo.matchedKeywords = keywords.filter(keyword => commentText.includes(keyword));
              }
              
              // Player name matching score
              const playerName = (event.player || event.player_name || '').toLowerCase();
              if (playerName && commentText.includes(playerName)) {
                score += 80; // High bonus for player name match
                debugInfo.fullPlayerScore = 80;
              }
              
              // Check for partial player name matches (first name or last name)
              if (playerName) {
                const playerParts = playerName.split(' ');
                const matchingParts = playerParts.filter(part => 
                  part.length > 2 && commentText.includes(part)
                ).length;
                if (matchingParts > 0) {
                  score += matchingParts * 40; // Bonus for partial name matches
                  debugInfo.partialPlayerScore = matchingParts * 40;
                  debugInfo.matchedPlayerParts = playerParts.filter(part => part.length > 2 && commentText.includes(part));
                }
              }
              
              // Minute proximity score (lower priority now)
              const minuteDiff = Math.abs((event.minute || 0) - commentMinute);
              if (minuteDiff === 0) {
                score += 30; // Bonus for exact minute match
                debugInfo.minuteScore = 30;
              } else if (minuteDiff === 1) {
                score += 15; // Smaller bonus for ±1 minute
                debugInfo.minuteScore = 15;
              } else {
                score += Math.max(0, 5 - minuteDiff); // Small bonus for closer minutes
                debugInfo.minuteScore = Math.max(0, 5 - minuteDiff);
              }
              
              // Debug detailed scoring for Gavin Bazunu case (expanded range)
              if (commentText.includes('gavin') || commentText.includes('bazunu') || (commentMinute >= 60 && commentMinute <= 65)) {
                console.log(`DEBUG - Event scoring for ${event.player || event.player_name} (${event.type}):`, {
                  debugInfo,
                  totalScore: score
                });
              }
              
              return { event, score };
            });
            
            // Debug scoring
            if (commentText.includes('gavin') || commentText.includes('yellow')) {
              console.log('DEBUG - Scored events:', scoredEvents.map(item => ({
                minute: item.event.minute,
                type: item.event.type,
                player: item.event.player,
                score: item.score
              })));
            }
            
            // Sort by score and pick the highest scoring event (require some content relevance, not just minute proximity)
            const bestMatch = scoredEvents
              .filter(item => item.score > 35) // More than just minute proximity points
              .sort((a, b) => b.score - a.score)[0];
              
            if (bestMatch) {
              matchingEvent = bestMatch.event;
              
              // Debug final match for Gavin Bazunu case (expanded range)
              if (commentText.includes('gavin') || commentText.includes('bazunu') || (commentMinute >= 60 && commentMinute <= 65)) {
                console.log('DEBUG - Final match:', {
                  commentMinute: commentMinute,
                  eventMinute: bestMatch.event.minute,
                  eventType: bestMatch.event.type,
                  eventPlayer: bestMatch.event.player || bestMatch.event.player_name,
                  finalScore: bestMatch.score
                });
              }
            }
          }

          const shouldFlash = c.is_goal === true && isNew;

          return (
            <li key={key} className={commentClass}>
              <div className="comment-box">
                <div className="comment-eventtype">
                  <div className="comment-call">
                    {matchingEvent && (
                      <div className="comment-event-type">
                        {matchingEvent.type && <p>{matchingEvent.type}{matchingEvent.type === "GOAL" ? "!!!" : ""}</p>}
                      </div>
                    )}
                    <div className="comment-icon">
                      {(() => {
                        // Debug emoji logic
                        if (c.minute >= 60 && c.minute <= 65) {
                          console.log(`DEBUG - Emoji logic for minute ${c.minute}:`, {
                            hasMatchingEvent: !!matchingEvent,
                            eventType: matchingEvent?.type,
                            is_goal: c.is_goal,
                            is_important: c.is_important,
                            commentText: (c.comment || "").substring(0, 50)
                          });
                        }
                        
                        // Only show emojis when there's actually a matched event
                        if (matchingEvent && matchingEvent.type === "GOAL") {
                          return <img src={goalIcon} alt="" className="event-icon"/> || "⚽";
                        } else if (matchingEvent && (matchingEvent.type === "YELLOWCARD" || matchingEvent.type === "YELLOW_CARD" || matchingEvent.type === "REDCARD" || matchingEvent.type === "RED_CARD")) {
                          return <img src={eventIcon} alt="Event" className="event-icon"/> || "❗";
                        } else if (matchingEvent && (matchingEvent.type === "SUBSTITUTION" || matchingEvent.type === "SUB")) {
                          return "🔄";  
                        } else {
                          return ""; // No emoji if no relevant matched event
                        }
                      })()}
                    </div>
                  </div>
                  {matchingEvent && (
                    <div className="event-info">

                      {matchingEvent.player && (
                        <span>
                          <strong>{matchingEvent.player}</strong>
                        </span>
                      )}
                      {/* {matchingEvent.result && (
                        <span> makes it {matchingEvent.result}</span>
                      )}
                      {matchingEvent.info && (
                        <span> with a {matchingEvent.info}</span>
                      )} */}
                      {/* {matchingEvent.addition && (
                        <span> {matchingEvent.addition}</span>
                      )} */}
                      {c.minute != null ? ` (${c.minute}')` : ""}
                    </div>
                  )}
                </div>
              </div>
              <div className="comment-details">
                <div>{c.minute != null ? ` ${c.minute}: ` : ""}{c.comment || ""}</div>
              </div>
            </li>
          );
        })}
      </ul>
      {/* <h3>Comments</h3>
      <ul
        style={{
          maxHeight: 240,
          overflow: "auto",
          padding: 8,
          border: "1px solid #ddd",
        }}
      >
        {sortCommentsByOrder(matchSnapshot.comments || []).map((c, i) => {
          // reuse same keying used in merge logic where possible
          const key =
            (c &&
              (c.order != null
                ? `order:${String(c.order)}`
                : c.comment_id || c.id
                ? `id:${c.comment_id || c.id}`
                : `text:${String(c.comment || c.comment_text || "").slice(
                    0,
                    200
                  )}|m:${c.minute || 0}`)) ||
            `c:${i}`;
          const isNew = newCommentKeysRef.current.has(key);
          return (
            <li
              key={key}
              style={{
                padding: "6px 4px",
                background: isNew ? "rgba(220,255,230,0.95)" : "transparent",
                transition: "background 400ms",
              }}
            >
              <div style={{ fontSize: 12, color: "#666" }}>
                {c.minute != null ? `${c.minute}'` : ""}{" "}
                {c.author ? `• ${c.author}` : ""}{" "}
                {c.source ? `(${c.source})` : ""}
              </div>
              <div style={{ marginTop: 4 }}>
                {c.comment || c.comment_text || c.text || ""}
              </div>
            </li>
          );
        })}
      </ul> */}
      <h3>Player ratings</h3>
      {console.log("matchSnapshotData: ", matchSnapshot)}
      {matchSnapshot.player_ratings && matchSnapshot.player_ratings.length ? (
        <ul>
          {matchSnapshot.player_ratings.map((r, i) => (
            <li key={i}>
              {r.player_name} — {r.rating}
            </li>
          ))}
        </ul>
      ) : (
        <p>Not available</p>
      )}
      <h3>Player ratings 2.0</h3>
      {console.log("matchSnapshotData: ", matchSnapshot)}
      {(() => {
        // Get the correct lineup based on team side
        let teamLineup = null;
        if (matchSnapshot.lineup) {
          if (isHomeTeam && matchSnapshot.lineup.home) {
            teamLineup = matchSnapshot.lineup.home;
          } else if (isAwayTeam && matchSnapshot.lineup.away) {
            teamLineup = matchSnapshot.lineup.away;
          } else if (Array.isArray(matchSnapshot.lineup)) {
            // Fallback: if lineup is a flat array (legacy format)
            teamLineup = matchSnapshot.lineup;
          }
        }

        if (teamLineup && teamLineup.length) {
          // Sort players by rating: highest first, null/undefined at bottom
          const sortedLineup = [...teamLineup].sort((a, b) => {
            const ratingA = a.rating;
            const ratingB = b.rating;

            // Handle null/undefined values - put them at the end
            if (ratingA == null && ratingB == null) return 0;
            if (ratingA == null) return 1; // a goes to bottom
            if (ratingB == null) return -1; // b goes to bottom

            // Both have ratings - sort descending (highest first)
            return Number(ratingB) - Number(ratingA);
          });

          return (
            <ul>
              {sortedLineup.map((r, i) => (
                <li key={i}>
                  {r.player_name} — {r.rating != null ? r.rating : "No rating"}
                </li>
              ))}
            </ul>
          );
        }

        return <p>Not available</p>;
      })()}
      <button
        onClick={() => {
          newEventIdsRef.current.clear();
          newCommentKeysRef.current.clear();
        }}
      >
        Clear new highlights
      </button>{" "}
      
    </div>
  );
}
