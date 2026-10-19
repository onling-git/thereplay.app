// src/pages/MatchLive.jsx
import React, { useEffect, useState, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import useSSE from "../hooks/useSSE";
import { sseMatchUrl, getMatch, getTeamSnapshot, getMatchSchema, getLeagueStandings } from "../api";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";
import Breadcrumbs from "../components/Breadcrumbs/Breadcrumbs";
import LiveMatchStructuredData from "../components/LiveMatchStructuredData";
import { isDismissalEvent, prepareLiveComments } from "../utils/liveCommentary";
import { getPlayerLineupEvents, getPlayerLineupEventDetails } from "../utils/lineupEvents";
import "./css/MatchReport.css";
import "./css/matchLive.css";

import goalIcon from "../assets/images/ball-icon.svg";
import eventIcon from "../assets/images/whistle-icon.svg";
import lineupGoalIcon from "../assets/icons/goal.svg";
import lineupAssistIcon from "../assets/icons/assist.svg";
import lineupRedCardIcon from "../assets/icons/red-card.svg";
import lineupYellowCardIcon from "../assets/icons/yellow-card.svg";
import lineupOwnGoalIcon from "../assets/icons/own-goal.svg";

export default function MatchLive() {
  const { matchId, teamSlug } = useParams(); // route: /:teamSlug/match/:matchId/live
  const url = sseMatchUrl(matchId);
  const { data: sseData, status } = useSSE(url, { retryMs: 6000 });
  const [matchSnapshot, setMatchSnapshot] = useState(null);
  const [error, setError] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [follow, setFollow] = useState(true);
  const [teamData, setTeamData] = useState({ home: null, away: null });
  const [activeTab, setActiveTab] = useState("commentary");
  const [activeLineupTeam, setActiveLineupTeam] = useState("home");
  const [standings, setStandings] = useState(null);
  const [loadingStandings, setLoadingStandings] = useState(false);
  const [matchSchema, setMatchSchema] = useState(null);
  const [matchSchemaError, setMatchSchemaError] = useState(false);


  // Debug specific match
  

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
      eventType.includes("penalty") ||
      isDismissalEvent(event.type) ||
      eventType.includes("redcard") ||
      eventType.includes("red_card") ||
      eventType.includes("red card")
    );
  };

  // helper: check if event should be displayed in Key Events tab (all important events)
  const isAllKeyEvent = (event) => {
    const eventType = String(event.type || "").toLowerCase();
    return (
      eventType.includes("goal") ||
      eventType.includes("owngoal") ||
      eventType.includes("own_goal") ||
      isDismissalEvent(event.type) ||
      eventType.includes("redcard") ||
      eventType.includes("red_card") ||
      eventType.includes("red card") ||
      eventType.includes("yellowcard") ||
      eventType.includes("yellow_card") ||
      eventType.includes("yellow card") ||
      eventType.includes("substitution") ||
      eventType.includes("sub") ||
      eventType.includes("penalty") ||
      eventType.includes("var") ||
      eventType === "goal" ||
      eventType === "yellowcard" ||
      eventType === "redcard" ||
      eventType === "substitution"
    );
  };

  // helper: get event icon based on event type
  const getEventIcon = (type) => {
    const eventType = String(type || "").toLowerCase();
    if (isDismissalEvent(type)) return "🟥";
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

  // helper: get comprehensive event icon for Key Events tab
  const getAllEventIcon = (type) => {
    const eventType = String(type || "").toLowerCase();
    if (isDismissalEvent(type)) return "🟥";
    if (eventType.includes("goal")) return "⚽";
    if (eventType.includes("owngoal") || eventType.includes("own_goal"))
      return "⚽";
    if (
      eventType.includes("redcard") ||
      eventType.includes("red_card") ||
      eventType.includes("red card")
    )
      return "🟥";
    if (
      eventType.includes("yellowcard") ||
      eventType.includes("yellow_card") ||
      eventType.includes("yellow card")
    )
      return "🟨";
    if (eventType.includes("substitution") || eventType.includes("sub"))
      return "🔄";
    if (eventType.includes("penalty")) return "🥅";
    if (eventType.includes("var")) return "📺";
    return "📋";
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
      const isPenalty = String(e.type || "").toUpperCase() === "PENALTY";
      return (
        <p key={i}>
          {e.player_name && <span>{e.player_name}</span>} (
          <span>{e.minute && `${e.minute}'`}</span>){" "}
          {/* <span>{e.type}</span>{" "} */}
          <span>{getEventIcon(isPenalty ? "goal" : e.type)}</span>
          {isPenalty && (
            <span style={{ fontSize: "0.85em", opacity: 0.8 }}> (pen)</span>
          )}
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

  // helper: return comments sorted by `order` (descending). Accepts array or undefined
  const sortCommentsByOrder = (comments) => {
    if (!Array.isArray(comments)) return [];

    const sorted = [...comments].sort((a, b) => {
      // Helper to detect if a comment is a final summary comment
      const isFinalSummary = (comment) => {
        const text = String(comment?.comment || comment?.comment_text || "").toLowerCase();
        return text.includes("game finishes") ||
          (text.includes("that's all") && text.includes("finishes"));
      };

      const aIsFinal = isFinalSummary(a);
      const bIsFinal = isFinalSummary(b);

      // Final summary comments always go to the top (first)
      if (aIsFinal && !bIsFinal) return -1;
      if (!aIsFinal && bIsFinal) return 1;

      // Primary sort: by minute (descending - latest minute first)
      // For comments without minute, use -1 so they sort to the bottom (unless they're final summaries)
      const minuteA =
        a?.minute != null && !isNaN(a.minute) ? Number(a.minute) : -1;
      const minuteB =
        b?.minute != null && !isNaN(b.minute) ? Number(b.minute) : -1;

      // If minutes are different, sort by minute (descending)
      if (minuteB !== minuteA) {
        return minuteB - minuteA;
      }

      // Secondary sort: within the same minute, sort by order (descending)
      const orderA = a?.order != null && !isNaN(a.order) ? Number(a.order) : 0;
      const orderB = b?.order != null && !isNaN(b.order) ? Number(b.order) : 0;

      return orderB - orderA;
    });

    return sorted;
  };

  // initial fetch (populate UI quickly)
  useEffect(() => {
    let active = true;
    setMatchSnapshot(null);
    setError(null);
    setMatchSchema(null);
    setMatchSchemaError(false);
    getMatch(teamSlug, matchId, { enrichLineup: true, includeStatistics: true })
      .then((match) => { if (active) setMatchSnapshot(match); })
      .catch((err) => {
        if (active) setError(err.body || err.message || "Failed to fetch match");
      });
    return () => { active = false; };
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
              .catch(() => ({ side: "home", data: null })),
          );
        }

        // Fetch away team data if available
        if (matchSnapshot.teams.away?.team_slug) {
          promises.push(
            getTeamSnapshot(matchSnapshot.teams.away.team_slug)
              .then((data) => ({ side: "away", data }))
              .catch(() => ({ side: "away", data: null })),
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

  // Fetch standings when match data is available
  useEffect(() => {
    if (!matchSnapshot?.match_info?.league?.id) return;

    const fetchStandings = async () => {
      setLoadingStandings(true);
      try {
        const leagueId = matchSnapshot.match_info.league.id;
        const response = await getLeagueStandings(leagueId);

        // API returns { ok: true, data: standing } where standing is a single object
        // Wrap it in an array for consistent rendering
        if (response?.ok && response?.data) {
          setStandings([response.data]);
        } else {
          setStandings(null);
        }
      } catch (error) {
        console.error("Error fetching standings:", error);
        setStandings(null);
      } finally {
        setLoadingStandings(false);
      }
    };

    fetchStandings();
  }, [matchSnapshot?.match_info?.league?.id]);

  // The backend owns canonical identity, phase changes and the frozen final graph.
  useEffect(() => {
    if (String(matchSnapshot?.match_id) !== String(matchId) || !teamSlug) return;
    let active = true;
    const fetchSchema = async () => {
      try {
        const schemaData = await getMatchSchema(teamSlug, matchId);
        if (!schemaData?.graph || !schemaData?.matchUrl) throw new Error('Match schema response is incomplete');
        if (active) {
          setMatchSchema({ ...schemaData, teamSlug, matchId });
          setMatchSchemaError(false);
        }
      } catch (error) {
        if (active) {
          setMatchSchema(null);
          setMatchSchemaError(true);
          console.error("Failed to fetch match schema:", error);
        }
      }
    };
    fetchSchema();
    return () => { active = false; };
  }, [matchSnapshot, teamSlug, matchId]);

  // When SSE gives data, merge/update UI
  useEffect(() => {
    if (!sseData || String(sseData.match_id) !== String(matchId)) return;
    // sseData expected to be full match doc or partial diff; merge intelligently
    setMatchSnapshot((prev) => {
      if (!prev) {
        // initialize prevEventsRef to current events
        const evs = Array.isArray(sseData.events) ? sseData.events : [];
        prevEventsRef.current = new Set(
          evs.map(
            (e) =>
              `${e.minute || ""}|${e.type || ""}|${e.player || ""}|${e.info || ""
              }`,
          ),
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
          const id = `${ev.minute || ""}|${ev.type || ""}|${ev.player || ""}|${ev.info || ""
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
            200,
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

        // Debug SSE merge sorting

        // sort by minute first (descending), then by order within same minute (descending)
        merged.sort((a, b) => {
          // Helper to detect if a comment is a final summary comment
          const isFinalSummary = (comment) => {
            const text = String(comment?.comment || comment?.comment_text || "").toLowerCase();
            return text.includes("game finishes") ||
              (text.includes("that's all") && text.includes("finishes"));
          };

          const aIsFinal = isFinalSummary(a);
          const bIsFinal = isFinalSummary(b);

          // Final summary comments always go to the top (first)
          if (aIsFinal && !bIsFinal) return -1;
          if (!aIsFinal && bIsFinal) return 1;

          // Primary sort: by minute (descending - latest minute first)
          const minuteA =
            a?.minute != null && !isNaN(a.minute) ? Number(a.minute) : -1;
          const minuteB =
            b?.minute != null && !isNaN(b.minute) ? Number(b.minute) : -1;

          // If minutes are different, sort by minute (descending)
          if (minuteB !== minuteA) {
            return minuteB - minuteA;
          }

          // Secondary sort: within the same minute, sort by order (descending)
          const orderA =
            a?.order != null && !isNaN(a.order) ? Number(a.order) : 0;
          const orderB =
            b?.order != null && !isNaN(b.order) ? Number(b.order) : 0;

          return orderB - orderA;
        });

        next.comments = merged;
        // ensure prevCommentKeysRef contains existing keys for subsequent diffs
        prevCommentKeysRef.current = new Set(Array.from(cmap.keys()));
      }

      // merge lineup/ratings if present
      if (sseData.lineup) next.lineup = sseData.lineup;
      if (sseData.player_ratings) next.player_ratings = sseData.player_ratings;
      if (sseData.statistics) next.statistics = sseData.statistics;
      if (sseData.teams) next.teams = sseData.teams;

      return next;
    });
  }, [sseData, matchId]);

  // Poll fallback when SSE status is error for a short period
  useEffect(() => {
    if (status !== "error") return;
    let mounted = true;
    const poll = async () => {
      try {
        const fresh = await getMatch(teamSlug, matchId, {
          enrichLineup: true,
          includeStatistics: true,
        });
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
        { once: true },
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
      } catch (e) { }
    }, 80);
    return () => clearTimeout(t);
  }, [matchSnapshot?.events, follow]);

  const schemaMatchesRoute = matchSchema?.teamSlug === teamSlug && matchSchema?.matchId === matchId;
  if (error) return <><LiveMatchStructuredData clear /><div>Error: {String(error)}</div></>;
  if (!matchSnapshot || !matchSnapshot.teams)
    return <><LiveMatchStructuredData matchId={matchId} /><div>Loading match… SSE status: {status}</div></>;

  return (
    <div className="match-live">
      <LiveMatchStructuredData
        matchId={matchId}
        clear={matchSchemaError}
        graph={schemaMatchesRoute ? matchSchema.graph : null}
        matchUrl={schemaMatchesRoute ? matchSchema.matchUrl : null}
      />
      <Breadcrumbs />
      {/* Header Ad */}
      <AdSenseAd
        slot="5183171853"
        format="auto"
        className="adsense-header adsense-banner"
      />
      <PremiumBanner />

      <section className="card match-report-card live-score-card" aria-label="Match score">
        <header className="match-report-header">
          <h6 className="accent-heading">
            {matchSnapshot.teams.home?.team_name ?? "Home"} vs {matchSnapshot.teams.away?.team_name ?? "Away"}
          </h6>
          <Link className="card-link" to={`/${teamSlug}`}>Back to team HUB →</Link>
        </header>
        <div className="match-live-scores">
          <div className="match-live-scores-left">
            <div className="team-badge-container-home">
              {teamData.home?.image_path && (
                <img src={teamData.home.image_path} alt={`${matchSnapshot.teams.home?.team_name || "Home"} badge`} />
              )}
            </div>
            <span className="match-live-team-name">{matchSnapshot.teams.home?.team_name ?? "Home"}</span>
          </div>
          <div className="match-live-scores-center">
            <span className="match-report-score" aria-live="polite" aria-atomic="true">
              {matchSnapshot.score?.home ?? "-"}:{matchSnapshot.score?.away ?? "-"}
            </span>
            <span className="match-live-date">
              {matchSnapshot.match_status?.short_name}
              {matchSnapshot.match_status?.minute != null && ` ${matchSnapshot.match_status.minute}'`}
            </span>
            {matchSnapshot.match_info?.starting_at && (
              <span className="match-live-date">
                {new Date(matchSnapshot.match_info.starting_at).toLocaleDateString("en-GB", {
                  weekday: "short", day: "numeric", month: "short", year: "numeric",
                })}
                {matchSnapshot.match_info?.venue?.name && (
                  <p className="match-venue">{matchSnapshot.match_info.venue.name}</p>
                )}
              </span>
            )}
          </div>
          <div className="match-live-scores-right">
            <div className="team-badge-container-away">
              {teamData.away?.image_path && (
                <img src={teamData.away.image_path} alt={`${matchSnapshot.teams.away?.team_name || "Away"} badge`} />
              )}
            </div>
            <span className="match-live-team-name">{matchSnapshot.teams.away?.team_name ?? "Away"}</span>
          </div>
        </div>
        <div className="live-score-events">
          <div className="home-events">{renderTeamEvents("home")}</div>
          <div className="away-events">{renderTeamEvents("away")}</div>
        </div>
      </section>
      {/* Inline Ad between match info and other content */}

      <AdSenseAd
        slot="8038180302"
        format="rectangle"
        className="adsense-inline adsense-medium-rectangle"
      />

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <div
          className={`tab-button ${activeTab === "commentary" ? "active" : ""} tabs-left`}
          onClick={() => setActiveTab("commentary")}
        >
          Commentary
        </div>
        <div
          className={`tab-button ${activeTab === "keyevents" ? "active" : ""}`}
          onClick={() => setActiveTab("keyevents")}
        >
          Key Events
        </div>
        <div
          className={`tab-button ${activeTab === "lineups" ? "active" : ""}`}
          onClick={() => setActiveTab("lineups")}
        >
          Lineups
        </div>
        <div
          className={`tab-button ${activeTab === "stats" ? "active" : ""}`}
          onClick={() => setActiveTab("stats")}
        >
          Stats
        </div>
        <div
          className={`tab-button ${activeTab === "table" ? "active" : ""} tabs-right`}
          onClick={() => setActiveTab("table")}
        >
          Table
        </div>
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === "commentary" && (
          <div className="tab-panel commentary-panel">
            <ul className="comments-list">
              {(() => {
                const usedEventIds = new Set(); // Track used events to prevent duplicates

                // First, deduplicate comments based on content and minute
                const deduplicatedComments = [];
                const sortedComments = prepareLiveComments(
                  sortCommentsByOrder(matchSnapshot.comments || []),
                  matchSnapshot.events || [],
                );
                sortedComments.forEach(({ matchingEvent }) => {
                  if (matchingEvent) {
                    usedEventIds.add(
                      matchingEvent.id ||
                      `${matchingEvent.minute}_${matchingEvent.type}_${matchingEvent.player || matchingEvent.player_name}`,
                    );
                  }
                });

                sortedComments.forEach((c, i) => {
                  const commentText = String(
                    c.comment || c.comment_text || "",
                  ).trim();
                  const minute = c.minute || 0;
                  const isGoal = c.is_goal || false;
                  const isImportant = c.is_important || false;

                  // For potential duplicates, check if we already have a very similar comment at the same minute
                  const isDuplicate = deduplicatedComments.some(
                    (existingComment) => {
                      const existingText = String(
                        existingComment.comment ||
                        existingComment.comment_text ||
                        "",
                      ).trim();
                      const existingMinute = existingComment.minute || 0;
                      const existingIsGoal = existingComment.is_goal || false;
                      const existingIsImportant =
                        existingComment.is_important || false;

                      // Must be same minute and same type (goal/important status)
                      if (
                        minute !== existingMinute ||
                        isGoal !== existingIsGoal ||
                        isImportant !== existingIsImportant
                      ) {
                        return false;
                      }

                      // Check for very similar text content (same player, same basic structure)
                      // Extract key information: player name and basic action
                      const extractKeyInfo = (text) => {
                        const lowerText = text.toLowerCase();
                        // Look for player names and key goal-related words
                        const playerMatch = text.match(
                          /([A-Z][a-z]+ [A-Z][a-z]+)/,
                        );
                        const player = playerMatch ? playerMatch[1] : "";
                        const hasGoal = lowerText.includes("goal");
                        const hasScores = lowerText.includes("scores");
                        const hasStrike =
                          lowerText.includes("strike") ||
                          lowerText.includes("shot");
                        const hasLeft = lowerText.includes("left");
                        const hasRight = lowerText.includes("right");

                        return {
                          player,
                          hasGoal,
                          hasScores,
                          hasStrike,
                          hasLeft,
                          hasRight,
                        };
                      };

                      const currentInfo = extractKeyInfo(commentText);
                      const existingInfo = extractKeyInfo(existingText);

                      // If key information matches, consider it a duplicate
                      return (
                        currentInfo.player === existingInfo.player &&
                        currentInfo.hasGoal === existingInfo.hasGoal &&
                        currentInfo.hasScores === existingInfo.hasScores &&
                        currentInfo.hasStrike === existingInfo.hasStrike &&
                        currentInfo.hasLeft === existingInfo.hasLeft &&
                        currentInfo.hasRight === existingInfo.hasRight &&
                        currentInfo.player !== "" // Must have found a player name
                      );
                    },
                  );

                  // Only add if it's not a duplicate
                  if (!isDuplicate) {
                    deduplicatedComments.push(c);
                  }
                });

                return deduplicatedComments.map((c, i) => {
                  const key =
                    (c &&
                      (c.order != null
                        ? `order:${String(c.order)}`
                        : c.comment_id || c.id
                          ? `id:${c.comment_id || c.id}`
                          : `text:${String(
                            c.comment || c.comment_text || "",
                          ).slice(0, 200)}|m:${c.minute || 0}`)) ||
                    `c:${i}`;

                  // Determine comment class based on properties
                  let commentClass = "standard-comment";
                  if (c.is_goal === true) {
                    commentClass = "goal-comment";
                  } else if (c.is_important === true) {
                    commentClass = "important-comment";
                  }

                  // Fuzzy match events with comments for goal and important comments only
                  let matchingEvent = c.matchingEvent || null;
                  if (
                    !matchingEvent &&
                    (c.is_goal === true || c.is_important === true) &&
                    c.minute != null &&
                    matchSnapshot.events
                  ) {
                    const commentText = (c.comment || "").toLowerCase();
                    const commentMinute = c.minute;

                    

                    // Define keyword mappings for event types
                    const eventKeywords = {
                      GOAL: [
                        "goal",
                        "scored",
                        "scores",
                        "scoring",
                        "finish",
                        "shot",
                      ],
                      YELLOW_CARD: ["yellow", "booked", "caution", "warned"],
                      YELLOWCARD: ["yellow", "booked", "caution", "warned"], // Handle both formats
                      RED_CARD: ["red", "dismissed", "sent off", "ejected"],
                      REDCARD: ["red", "dismissed", "sent off", "ejected"], // Handle both formats
                      SUBSTITUTION: [
                        "substitute",
                        "sub",
                        "replaced",
                        "comes on",
                        "off for",
                      ],
                      FOUL: ["foul", "fouled", "challenge", "tackle"],
                    };

                    // Find events within ±3 minutes of the comment
                    const nearbyEvents = matchSnapshot.events.filter(
                      (event) =>
                        Math.abs((event.minute || 0) - commentMinute) <= 3,
                    );

                    // Debug nearby events for Gavin Bazunu case
                    

                    // Score events based on keyword matching, player name, and minute proximity
                    const scoredEvents = nearbyEvents.map((event) => {
                      let score = 0;
                      let debugInfo = {};

                      // Keyword matching score (highest priority)
                      const eventType = event.type || "";
                      const keywords = eventKeywords[eventType] || [];

                      // Check if any keywords match the comment text
                      const keywordMatches = keywords.filter((keyword) =>
                        commentText.includes(keyword),
                      ).length;

                      if (keywordMatches > 0) {
                        score += keywordMatches * 100; // Very high bonus for keyword matches
                        debugInfo.keywordScore = keywordMatches * 100;
                        debugInfo.matchedKeywords = keywords.filter((keyword) =>
                          commentText.includes(keyword),
                        );
                      }

                      // Player name matching score
                      const playerName = (
                        event.player ||
                        event.player_name ||
                        ""
                      ).toLowerCase();
                      if (playerName && commentText.includes(playerName)) {
                        score += 80; // High bonus for player name match
                        debugInfo.fullPlayerScore = 80;
                      }

                      // Check for partial player name matches (first name or last name)
                      if (playerName) {
                        const playerParts = playerName.split(" ");
                        const matchingParts = playerParts.filter(
                          (part) =>
                            part.length > 2 && commentText.includes(part),
                        ).length;
                        if (matchingParts > 0) {
                          score += matchingParts * 40; // Bonus for partial name matches
                          debugInfo.partialPlayerScore = matchingParts * 40;
                          debugInfo.matchedPlayerParts = playerParts.filter(
                            (part) =>
                              part.length > 2 && commentText.includes(part),
                          );
                        }
                      }

                      // Minute proximity score (lower priority now)
                      const minuteDiff = Math.abs(
                        (event.minute || 0) - commentMinute,
                      );
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

                      // Debug detailed scoring for Gavin Bazunu case
                      

                      return { event, score };
                    });

                    // Debug scoring
                    

                    // Sort by score and pick the highest scoring event (require some content relevance, not just minute proximity)
                    // Also filter out already used events to prevent duplicates
                    const bestMatch = scoredEvents
                      .filter((item) => {
                        const eventId =
                          item.event.id ||
                          `${item.event.minute}_${item.event.type}_${item.event.player || item.event.player_name
                          }`;
                        return item.score > 35 && !usedEventIds.has(eventId); // More than just minute proximity points AND not already used
                      })
                      .sort((a, b) => b.score - a.score)[0];

                    if (bestMatch) {
                      matchingEvent = bestMatch.event;

                      // Mark this event as used to prevent duplicate matching
                      const eventId =
                        bestMatch.event.id ||
                        `${bestMatch.event.minute}_${bestMatch.event.type}_${bestMatch.event.player || bestMatch.event.player_name
                        }`;
                      usedEventIds.add(eventId);

                      // Debug final match for Gavin Bazunu case
                      
                    }
                  }

                  return (
                    <li key={key} className={`card ${commentClass}`}>
                      <div className="comment-box">
                        <div className="comment-eventtype">
                          <div className="comment-call">
                            {matchingEvent && (
                              <div className="comment-event-type">
                                {matchingEvent.type && (
                                  <p>
                                    {isDismissalEvent(matchingEvent.type) ? "RED CARD" : matchingEvent.type}
                                    {matchingEvent.type === "GOAL" ? "!!!" : ""}
                                  </p>
                                )}
                              </div>
                            )}
                            <div className="comment-icon">
                              {(() => {
                                // Debug emoji logic for specific cases
                                

                                // Only show emojis when there's actually a matched event
                                if (
                                  matchingEvent &&
                                  matchingEvent.type === "GOAL"
                                ) {
                                  return (
                                    (
                                      <img
                                        src={goalIcon}
                                        alt=""
                                        className="event-icon"
                                      />
                                    ) || "⚽"
                                  );
                                } else if (
                                  matchingEvent &&
                                  (isDismissalEvent(matchingEvent.type) ||
                                    matchingEvent.type === "YELLOWCARD" ||
                                    matchingEvent.type === "YELLOW_CARD" ||
                                    matchingEvent.type === "REDCARD" ||
                                    matchingEvent.type === "RED_CARD")
                                ) {
                                  return (
                                    (
                                      <img
                                        src={eventIcon}
                                        alt="Event"
                                        className="event-icon"
                                      />
                                    ) || "❗"
                                  );
                                } else if (
                                  matchingEvent &&
                                  (matchingEvent.type === "SUBSTITUTION" ||
                                    matchingEvent.type === "SUB")
                                ) {
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
                        <div>
                          {c.minute != null ? ` ${c.minute}: ` : ""}
                          {c.comment || ""}
                        </div>
                      </div>
                    </li>
                  );
                });
              })()}
            </ul>
          </div>
        )}

        {activeTab === "keyevents" && (
          <div className="tab-panel keyevents-panel">
            <div className="key-events-list">
              <div className="key-events-list-team-names">
                <span>{matchSnapshot.teams?.home?.team_name}</span>
                <span>{matchSnapshot.teams?.away?.team_name}</span>
              </div>


              {(() => {
                const keyEvents = sortEventsByMinute(matchSnapshot.events || [])
                  .filter((e) => isAllKeyEvent(e))
                  .reverse(); // Reverse to get descending order (latest events first)

                if (keyEvents.length === 0) {
                  return <p>No key events yet</p>;
                }

                return keyEvents.map((event, i) => {
                  // Determine team for this event
                  let teamName = "Unknown";
                  let teamSide = "";

                  if (
                    event.team === "home" &&
                    matchSnapshot.teams?.home?.team_name
                  ) {
                    teamName = matchSnapshot.teams.home.team_name;
                    teamSide = "home";
                  } else if (
                    event.team === "away" &&
                    matchSnapshot.teams?.away?.team_name
                  ) {
                    teamName = matchSnapshot.teams.away.team_name;
                    teamSide = "away";
                  } else if (event.participant_id) {
                    // Fallback: use participant_id to determine team
                    const homeTeamId = matchSnapshot.teams?.home?.team_id;
                    const awayTeamId = matchSnapshot.teams?.away?.team_id;

                    if (String(event.participant_id) === String(homeTeamId)) {
                      teamName = matchSnapshot.teams.home.team_name;
                      teamSide = "home";
                    } else if (
                      String(event.participant_id) === String(awayTeamId)
                    ) {
                      // eslint-disable-next-line no-unused-vars
                      teamName = matchSnapshot.teams.away.team_name;
                      teamSide = "away";
                    }
                  }


                  return (
                    <div key={i} className={"key-event-item"}>

                      <div className="home-event">

                        {teamSide === "home" && (
                          <>
                            {event.type === "SUBSTITUTION" ||
                              event.type === "SUB" ? (
                              <div className="substitution-details">
                                {event.player_name && (
                                  <div className="player-on">
                                    In: {event.player_name}
                                  </div>
                                )}
                                {event.related_player_name && (
                                  <div className="player-off">
                                    Out: {event.related_player_name}
                                  </div>
                                )}
                              </div>
                            ) : (
                              (event.player_name || event.player) && (
                                <div className="event-player">
                                  {event.player_name || event.player}
                                </div>
                              )
                            )}
                            {event.info ? (
                              <div className="event-info">{event.info}</div>
                            ) : event.type === "MISSED_PENALTY" ? (
                              <div className="event-info">
                                {event.addition === "GoalkeeperSave"
                                  ? "Penalty saved"
                                  : event.addition
                                    ? event.addition
                                      .replace(/([A-Z])/g, " $1")
                                      .trim()
                                      .toLowerCase()
                                    : "Penalty missed"}
                              </div>
                            ) : null}
                            {event.result && (
                              <div className="event-result">{event.result}</div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Center: icon */}
                      <div className="event-icon">
                        <span>{getAllEventIcon(event.type)}</span>
                        <div className="event-time">{event.minute || "?"}'</div>
                      </div>

                      {/* Right side: away event (or empty placeholder) */}
                      <div className="away-event">
                        {teamSide === "away" && (
                          <>
                            {event.type === "SUBSTITUTION" ||
                              event.type === "SUB" ? (
                              <div className="substitution-details">
                                {event.player_name && (
                                  <div className="player-on">
                                    In: {event.player_name}
                                  </div>
                                )}
                                {event.related_player_name && (
                                  <div className="player-off">
                                    Out: {event.related_player_name}
                                  </div>
                                )}
                              </div>
                            ) : (
                              (event.player_name || event.player) && (
                                <div className="event-player">
                                  {event.player_name || event.player}
                                </div>
                              )
                            )}
                            {event.info ? (
                              <div className="event-info">{event.info}</div>
                            ) : event.type === "MISSED_PENALTY" ? (
                              <div className="event-info">
                                {event.addition === "GoalkeeperSave"
                                  ? "Penalty saved"
                                  : event.addition
                                    ? event.addition
                                      .replace(/([A-Z])/g, " $1")
                                      .trim()
                                      .toLowerCase()
                                    : "Penalty missed"}
                              </div>
                            ) : null}
                            {event.result && (
                              <div className="event-result">{event.result}</div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {activeTab === "lineups" && (
          <div className="tab-panel lineups-panel">
            {/* Team Selection Toggle */}
            <div className="lineup-team-toggle">
              <button
                className={`team-toggle-button ${activeLineupTeam === "home" ? "active" : ""}`}
                onClick={() => setActiveLineupTeam("home")}
              >
                {matchSnapshot?.teams?.home?.team_name || "Home"}
              </button>
              <button
                className={`team-toggle-button ${activeLineupTeam === "away" ? "active" : ""}`}
                onClick={() => setActiveLineupTeam("away")}
              >
                {matchSnapshot?.teams?.away?.team_name || "Away"}
              </button>
            </div>

            <div className="lineups-content">
              {(() => {
                // Get lineup for the active team
                let activeLineup = null;
                let activeTeamName = "";
                let isReversed = false;

                if (matchSnapshot.lineup) {
                  if (
                    activeLineupTeam === "home" &&
                    matchSnapshot.lineup.home
                  ) {
                    activeLineup = matchSnapshot.lineup.home;
                    activeTeamName =
                      matchSnapshot.teams.home?.team_name || "Home";
                    isReversed = false;
                  } else if (
                    activeLineupTeam === "away" &&
                    matchSnapshot.lineup.away
                  ) {
                    activeLineup = matchSnapshot.lineup.away;
                    activeTeamName =
                      matchSnapshot.teams.away?.team_name || "Away";
                    isReversed = false;
                  }

                  // Fallback: if lineup is a flat array (legacy format), use for current team
                  if (Array.isArray(matchSnapshot.lineup)) {
                    if (
                      (activeLineupTeam === "home" && isHomeTeam) ||
                      (activeLineupTeam === "away" && isAwayTeam)
                    ) {
                      activeLineup = matchSnapshot.lineup;
                      activeTeamName =
                        activeLineupTeam === "home"
                          ? matchSnapshot.teams.home?.team_name || "Home"
                          : matchSnapshot.teams.away?.team_name || "Away";
                      isReversed = activeLineupTeam === "away";
                    }
                  }
                }

                // Check if we have lineup data for the active team
                if (
                  !activeLineup ||
                  !Array.isArray(activeLineup) ||
                  activeLineup.length === 0
                ) {
                  return (
                    <div className="no-lineup-data">
                      <p>No lineup data available for {activeTeamName}</p>
                    </div>
                  );
                }

                // Function to process a team's formation
                // Process the active team's formation
                const formationResult = processTeamFormation(
                  activeLineup,
                  activeTeamName,
                  isReversed,
                  activeLineupTeam === "away", // reverseHorizontal: flip player positions left-to-right for away team
                );

                if (!formationResult) {
                  return (
                    <div className="no-formation-data">
                      <p>No formation data available for {activeTeamName}</p>
                    </div>
                  );
                }

                return formationResult;

                function processTeamFormation(
                  teamLineup,
                  teamName,
                  isReversed = false,
                  reverseHorizontal = false,
                ) {
                  if (!teamLineup || !teamLineup.length) return null;

                  // Create a map of player ratings by player_id for quick lookup
                  const ratingsMap = new Map();
                  if (
                    matchSnapshot.player_ratings &&
                    Array.isArray(matchSnapshot.player_ratings)
                  ) {
                    matchSnapshot.player_ratings.forEach((rating) => {
                      if (rating.player_id && rating.rating != null) {
                        ratingsMap.set(String(rating.player_id), rating.rating);
                      }
                    });
                  }

                  // Match lineup players with their ratings
                  const playersWithRatings = teamLineup.map((player) => ({
                    ...player,
                    matchedRating:
                      ratingsMap.get(String(player.player_id)) ||
                      player.rating ||
                      null,
                  }));

                  // Check for substitutions in events to determine player status
                  const getPlayerSubstitutionStatus = (
                    playerId,
                    playerName,
                  ) => {
                    if (!matchSnapshot.events)
                      return { substituted: false, isSubstitute: false };

                    const playerIdStr = String(playerId);
                    let substitutedOut = false;
                    let substitutedIn = false;

                    matchSnapshot.events.forEach((event) => {
                      if (
                        event.type === "SUBSTITUTION" ||
                        event.type === "SUB"
                      ) {
                        // Player was substituted OUT (related_player_name is the player going off)
                        if (
                          (event.related_player_name &&
                            event.related_player_name === playerName) ||
                          (event.related_player_id &&
                            String(event.related_player_id) === playerIdStr)
                        ) {
                          substitutedOut = true;
                        }

                        // Player was substituted IN (player_name is the player coming on)
                        if (
                          (event.player_name &&
                            event.player_name === playerName) ||
                          (event.player_id &&
                            String(event.player_id) === playerIdStr)
                        ) {
                          substitutedIn = true;
                        }
                      }
                    });

                    return {
                      substituted: substitutedOut,
                      isSubstitute: substitutedIn,
                    };
                  };

                  // Separate starting XI and bench players
                  const actualParticipants = playersWithRatings; // Include ALL players, not just those who participated

                  const startingXI = [];
                  const benchPlayers = [];

                  actualParticipants.forEach((player) => {
                    const subStatus = getPlayerSubstitutionStatus(
                      player.player_id,
                      player.player_name,
                    );

                    if (subStatus.isSubstitute) {
                      benchPlayers.push(player);
                    } else if (
                      player.formation_position ||
                      player.formation_field
                    ) {
                      startingXI.push(player);
                    } else if (player.matchedRating != null) {
                      startingXI.push(player);
                    } else {
                      benchPlayers.push(player); // Include players who didn't play in bench
                    }
                  });

                  // Remove the duplicate processing that was filtering out non-participants
                  // playersWithRatings.forEach(player => {
                  //   if (!actualParticipants.find(p => String(p.player_id) === String(player.player_id))) {
                  //     benchPlayers.push(player);
                  //   }
                  // });

                  const startingEleven = startingXI
                    .sort((a, b) => {
                      const posA = a.formation_position || a.position_id || 999;
                      const posB = b.formation_position || b.position_id || 999;
                      return posA - posB;
                    })
                    .slice(0, 11);

                  // Group starting players by formation lines using SportMonks formation_field
                  const groupPlayersByFormationField = (
                    players,
                    isReversed = false,
                    reverseHorizontal = false,
                  ) => {
                    const lineMap = new Map(); // line number -> players array

                    // Debug: log all formation data before processing

                    players.forEach((player) => {
                      let lineNumber = 1; // default to goalkeeper line

                      // Parse formation_field (format: "line:position" e.g., "2:4")
                      if (
                        player.formation_field &&
                        typeof player.formation_field === "string"
                      ) {
                        const parts = player.formation_field.split(":");
                        if (parts.length >= 1 && !isNaN(parseInt(parts[0]))) {
                          lineNumber = parseInt(parts[0]);
                        }
                      } else if (player.formation_position) {
                        // Fallback: estimate line from formation_position
                        // Position 1 = GK (line 1)
                        // Positions 2-5 typically defense (line 2)
                        // Positions 6-8 typically midfield (line 3)
                        // Positions 9-11 typically attack (line 4)
                        const pos = player.formation_position;
                        if (pos === 1) {
                          lineNumber = 1;
                        } else if (pos >= 2 && pos <= 5) {
                          lineNumber = 2;
                        } else if (pos >= 6 && pos <= 8) {
                          lineNumber = 3;
                        } else if (pos >= 9 && pos <= 11) {
                          lineNumber = 4;
                        } else {
                          lineNumber = 4; // Default high positions to attack
                        }
                      } else if (player.position_id) {
                        // Final fallback: use generic position_id
                        const posId = player.position_id;
                        if (posId === 1) {
                          lineNumber = 1; // GK
                        } else if (posId >= 2 && posId <= 5) {
                          lineNumber = 2; // Defense
                        } else if (posId >= 6 && posId <= 8) {
                          lineNumber = 3; // Midfield
                        } else {
                          lineNumber = 4; // Attack
                        }
                      }

                      // Debug: log each player's line assignment

                      if (!lineMap.has(lineNumber)) {
                        lineMap.set(lineNumber, []);
                      }
                      lineMap.get(lineNumber).push(player);
                    });

                    // Sort players within each line by formation_field position or formation_position
                    lineMap.forEach((playersInLine, lineNumber) => {
                      playersInLine.sort((a, b) => {
                        // Try to sort by formation_field position (second part of "line:position")
                        if (a.formation_field && b.formation_field) {
                          const posA = parseInt(
                            a.formation_field.split(":")[1] || "0",
                          );
                          const posB = parseInt(
                            b.formation_field.split(":")[1] || "0",
                          );
                          // Sort by position within line (left to right, smallest numbers first)
                          // For away team (reverseHorizontal), reverse the horizontal order
                          if (!isNaN(posA) && !isNaN(posB)) {
                            return reverseHorizontal ? posB - posA : posA - posB;
                          }
                        }
                        // Fallback to formation_position or position_id (ascending order for left-to-right)
                        const fallbackA =
                          a.formation_position || a.position_id || 0;
                        const fallbackB =
                          b.formation_position || b.position_id || 0;
                        return reverseHorizontal ? fallbackB - fallbackA : fallbackA - fallbackB;
                      });
                    });

                    // Convert to dynamic formation lines based on actual line numbers
                    const sortedLines = Array.from(lineMap.keys()).sort(
                      (a, b) => a - b,
                    ); // Always sort ascending first
                    const formationLines = {
                      goalkeeper: lineMap.get(1) || [], // Line 1 is always goalkeeper
                      outfieldLines: [], // Array of line objects with line number and players
                    };

                    // Create dynamic outfield lines (skip goalkeeper line)
                    const outfieldLineNumbers = sortedLines.filter(
                      (line) => line !== 1,
                    );

                    // For away team, we need to reverse the outfield lines order for display
                    // but keep the goalkeeper at line 1
                    const finalOutfieldOrder = isReversed
                      ? [...outfieldLineNumbers].reverse()
                      : outfieldLineNumbers;

                    finalOutfieldOrder.forEach((lineNumber) => {
                      formationLines.outfieldLines.push({
                        lineNumber: lineNumber,
                        players: lineMap.get(lineNumber) || [],
                      });
                    });

                    return formationLines;
                  };

                  const formationLines = groupPlayersByFormationField(
                    startingEleven,
                    isReversed,
                    reverseHorizontal,
                  );

                  // Debug formation lines after grouping

                  const renderPlayer = (player) => {
                    const playerEvents = getPlayerLineupEvents(player, matchSnapshot.events || [], activeLineupTeam);
                    const subStatus = getPlayerSubstitutionStatus(
                      player.player_id,
                      player.player_name,
                    );
                    const isSubstituted = subStatus.substituted; // Player was taken off
                    const isSubstitute = subStatus.isSubstitute; // Player came on

                    // Check if player actually participated (has rating, was in events, or has formation data)
                    const hasRating = player.matchedRating != null;
                    const hasFormationData =
                      player.formation_position || player.formation_field;
                    const wasInEvents =
                      matchSnapshot.events &&
                      matchSnapshot.events.some(
                        (event) =>
                          String(event.player_id) ===
                          String(player.player_id) ||
                          event.player_name === player.player_name,
                      );
                    const didNotPlay =
                      !hasRating && !hasFormationData && !wasInEvents;

                    // Check if this player is the man of the match
                    const isManOfTheMatch =
                      matchSnapshot.player_of_the_match &&
                      (matchSnapshot.player_of_the_match ===
                        player.player_name ||
                        matchSnapshot.player_of_the_match.toLowerCase() ===
                        player.player_name?.toLowerCase());

                    return (
                      <div
                        key={player.player_id || player.player_name}
                        className={`formation-player ${isSubstituted ? "substituted" : ""
                          } ${isSubstitute ? "substitute-in" : ""} ${didNotPlay ? "did-not-play" : ""
                          } ${isManOfTheMatch ? "man-of-the-match" : ""}`}
                      >
                        <div className="formation-player-inner">
                          {playerEvents?.goals > 0 && (
                            <span className="lineup-event-badge lineup-goal-badge" role="img"
                              aria-label={`${playerEvents.goals} ${playerEvents.goals === 1 ? "goal" : "goals"}`}
                              title={`${playerEvents.goals} ${playerEvents.goals === 1 ? "goal" : "goals"}`}>
                              <img src={lineupGoalIcon} alt="" aria-hidden="true" />
                              {playerEvents.goals > 1 && <span className="lineup-event-count" aria-hidden="true">{playerEvents.goals}</span>}
                            </span>
                          )}
                          {playerEvents?.assists > 0 && (
                            <span className="lineup-event-badge lineup-assist-badge" role="img"
                              aria-label={`${playerEvents.assists} ${playerEvents.assists === 1 ? "assist" : "assists"}`}
                              title={`${playerEvents.assists} ${playerEvents.assists === 1 ? "assist" : "assists"}`}>
                              <img src={lineupAssistIcon} alt="" aria-hidden="true" />
                              {playerEvents.assists > 1 && <span className="lineup-event-count" aria-hidden="true">{playerEvents.assists}</span>}
                            </span>
                          )}
                          {playerEvents?.card && (
                            <span className="lineup-event-badge lineup-card-badge" role="img"
                              aria-label={playerEvents.card === "red" ? "Red card" : "Yellow card"}
                              title={playerEvents.card === "red" ? "Red card" : "Yellow card"}>
                              <img src={playerEvents.card === "red" ? lineupRedCardIcon : lineupYellowCardIcon} alt="" aria-hidden="true" />
                            </span>
                          )}
                          {playerEvents?.ownGoals > 0 && (
                            <span className="lineup-event-badge lineup-own-goal-badge" role="img"
                              aria-label={`${playerEvents.ownGoals} ${playerEvents.ownGoals === 1 ? "own goal" : "own goals"}`}
                              title={`${playerEvents.ownGoals} ${playerEvents.ownGoals === 1 ? "own goal" : "own goals"}`}>
                              <img src={lineupOwnGoalIcon} alt="" aria-hidden="true" />
                              {playerEvents.ownGoals > 1 && <span className="lineup-event-count" aria-hidden="true">{playerEvents.ownGoals}</span>}
                            </span>
                          )}
                          {(isSubstituted || isSubstitute) && (
                            <div className="substitution-icon">
                              {isSubstituted ? "↓" : "↑"}
                            </div>
                          )}


                          <div className="player-image-container">

                            {player.image_path ? (
                              <img
                                src={player.image_path}
                                alt={player.player_name}
                                className="player-image"
                                onError={(e) => {
                                  e.target.style.display = "none";
                                  e.target.nextSibling.style.display = "flex";
                                }}
                              />
                            ) : null}
                            <div
                              className="player-placeholder"
                              style={{
                                display: player.image_path ? "none" : "flex",
                              }}
                            >
                              <span className="player-initials">
                                {player.player_name
                                  ? player.player_name
                                    .split(" ")
                                    .map((n) => n[0])
                                    .join("")
                                    .substring(0, 2)
                                  : "??"}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="player-name">
                          {player.player_name
                            ? player.player_name.split(" ").pop()
                            : "Unknown"}
                        </div>

                        {/* {player.jersey_number && (
                            <div className="player-number">
                              {player.jersey_number}
                            </div>
                          )} */}


                      </div>
                    );
                  };

                  const renderSquadPlayer = (player, section) => {
                    const subStatus = getPlayerSubstitutionStatus(player.player_id, player.player_name);
                    const details = getPlayerLineupEventDetails(player, matchSnapshot.events || [], activeLineupTeam);
                    const eventLabels = {
                      goal: "Goal", assist: "Assist", "own-goal": "Own goal",
                      "yellow-card": "Yellow card", "red-card": "Red card",
                      "sub-on": "Substituted on", "sub-off": "Substituted off",
                    };
                    const eventIcons = {
                      goal: lineupGoalIcon, assist: lineupAssistIcon, "own-goal": lineupOwnGoalIcon,
                      "yellow-card": lineupYellowCardIcon, "red-card": lineupRedCardIcon,
                    };
                    return (
                      <li key={player.player_id || player.player_name}
                        className={`${section}-player${subStatus.substituted ? ` ${section}-player-substituted` : ""}${subStatus.isSubstitute ? ` ${section}-player-substitute-in` : ""}`}>
                        {player.image_path && (
                          <img className={`${section}-player-avatar`} src={player.image_path} alt="" />
                        )}
                        {player.jersey_number != null && (
                          <span className={`${section}-player-shirt-number`}>{player.jersey_number}</span>
                        )}
                        <span className={`${section}-player-full-name`}>{player.player_name || "Unknown player"}</span>
                        <span className={`${section}-player-events`}>
                          {details.map((event, index) => {
                            const time = event.minute == null ? "" :
                              `${event.minute}${Number(event.extraMinute) > 0 ? `+${event.extraMinute}` : ""}'`;
                            const substitution = event.kind === "sub-on" || event.kind === "sub-off";
                            return (
                              <span key={index}
                                className={`${section}-player-event ${section}-player-event-${event.kind}${substitution ? ` ${section}-player-substitution` : ""}`}
                                aria-label={eventLabels[event.kind]}>
                                {substitution ? (
                                  <span aria-hidden="true">{event.kind === "sub-on" ? "↑" : "↓"}</span>
                                ) : (
                                  <img src={eventIcons[event.kind]} alt="" />
                                )}
                                {time && <span>{time}</span>}
                                {substitution && (
                                  <span>{event.kind === "sub-on" ? "for " : "replaced by "}{event.relatedPlayer || "Unknown player"}</span>
                                )}
                              </span>
                            );
                          })}
                        </span>
                        {player.matchedRating != null && (
                          <span className={`${section}-player-match-rating`} aria-label={`Player rating: ${player.matchedRating}`}>{player.matchedRating}</span>
                        )}
                      </li>
                    );
                  };

                  return (
                    <div className="formation-display">
                      {/* <h4>{activeTeamName} Formation</h4> */}
                      <div className="formation-display-inner">
                        {/* Football Pitch */}
                        <div className="football-pitch">
                          <svg className="pitch-surface" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            <path fill="#35975e87" d="M 14 0 H 86 Q 88 0 88.24 2 L 100 100 H 0 L 11.76 2 Q 12 0 14 0 Z" />
                            <path fill="#2faf649c" d="M 22 0 H 32 L 26.32 100 H 13.16 Z M 45 0 H 55 L 56.58 100 H 43.42 Z M 68 0 H 78 L 86.84 100 H 73.68 Z" />
                            <g fill="none" stroke="rgba(255, 255, 255, 0.484)" strokeWidth="2">
                              <path d="M 6 50 H 94" vectorEffect="non-scaling-stroke" />
                              <ellipse cx="50" cy="50" rx="14" ry="10" vectorEffect="non-scaling-stroke" />
                            </g>
                          </svg>
                          
                          
                          
                          

                          {/* For home team: GK first (top), then outfield lines in order (defense, midfield, attack) */}
                          {/* For away team: outfield lines first (attack, midfield, defense), then GK last (bottom) */}
                          {!isReversed &&
                            formationLines.goalkeeper.length > 0 && (
                              <div className="formation-line goalkeeper-line">
                                
                                {formationLines.goalkeeper.map((player) =>
                                  renderPlayer(player),
                                )}
                              </div>
                            )}

                          {/* Render outfield lines */}
                          {formationLines.outfieldLines.map((line, index) => (
                            <div
                              key={line.lineNumber}
                              className={`formation-line formation-line-${line.lineNumber}`}
                            >
                              
                              {line.players.map((player) => renderPlayer(player))}
                            </div>
                          ))}

                          {/* For away team: GK at the end (bottom) */}
                          {isReversed && formationLines.goalkeeper.length > 0 && (
                            <div className="formation-line goalkeeper-line">
                              
                              {formationLines.goalkeeper.map((player) =>
                                renderPlayer(player),
                              )}
                            </div>
                          )}
                        </div>
                        <div className="lineup-squad">
                          <section className="squad-area" aria-label="Starting XI">
                            <h5>Starting XI</h5>
                            <ul className="squad-players">
                              {startingEleven.map((player) => renderSquadPlayer(player, "squad"))}
                            </ul>
                          </section>
                          <section className="bench-area" aria-label="Bench">
                            <h5>Bench</h5>
                            {benchPlayers.length > 0 ? (
                              <ul className="bench-players">
                                {benchPlayers.map((player) => renderSquadPlayer(player, "bench"))}
                              </ul>
                            ) : (
                              <p className="bench-empty">No bench players available</p>
                            )}
                          </section>
                        </div>
                      </div>

                    </div>
                  );
                }
              })()}
            </div>
          </div>
        )}

        {activeTab === "stats" && (
          <div className="tab-panel stats-panel">
            <div className="stats-content">
              {(() => {
                // Check if match is inplay or finished to show statistics
                const matchStatus =
                  matchSnapshot?.match_status?.short_name ||
                  matchSnapshot?.match_status?.state ||
                  "";
                const isInplayOrFinished = [
                  "1H",
                  "2H",
                  "HT",
                  "ET",
                  "BT",
                  "P",
                  "SUSP",
                  "FT",
                  "FINISHED",
                  "ENDED",
                ].includes(matchStatus.toUpperCase());

                if (!isInplayOrFinished) {
                  return (
                    <div className="stats-unavailable">
                      <p>
                        Match statistics will be available during and after the
                        match
                      </p>
                    </div>
                  );
                }

                const statistics = matchSnapshot?.statistics;
                if (
                  !statistics ||
                  (!statistics.home?.length && !statistics.away?.length)
                ) {
                  return (
                    <div className="stats-unavailable">
                      <p>Statistics not yet available for this match</p>
                      <p>
                        <small>Match ID: {matchSnapshot?.match_id}</small>
                      </p>
                    </div>
                  );
                }


                // Get team names for display
                const homeTeamName =
                  matchSnapshot?.teams?.home?.team_name || "Home";
                const awayTeamName =
                  matchSnapshot?.teams?.away?.team_name || "Away";

                // Group statistics by type for better display
                const groupStatsByType = (stats) => {
                  const grouped = {};
                  stats.forEach((stat) => {
                    const type = stat.type || "Unknown";
                    if (!grouped[type]) grouped[type] = [];
                    grouped[type].push(stat);
                  });
                  return grouped;
                };

                const homeStats = groupStatsByType(statistics.home || []);
                const awayStats = groupStatsByType(statistics.away || []);

                // Get all unique stat types (excluding Assists) and sort with Possession first
                const allStatTypes = [
                  ...new Set([
                    ...Object.keys(homeStats),
                    ...Object.keys(awayStats),
                  ]),
                ]
                  .filter((statType) => statType !== "Assists")
                  .sort((a, b) => {
                    // Always put Possession first (case-insensitive check)
                    const aLower = a.toLowerCase();
                    const bLower = b.toLowerCase();
                    if (aLower.includes("possession")) return -1;
                    if (bLower.includes("possession")) return 1;
                    // Sort others alphabetically
                    return a.localeCompare(b);
                  });

                // Debug: Log all stat types

                return (
                  <div className="match-statistics">
                    <div className="stats-header">
                      <span className="team-name home">{homeTeamName}</span>

                      <span className="team-name away">{awayTeamName}</span>
                    </div>

                    <div className="stats-grid">
                      {allStatTypes.map((statType) => {
                        const homeStatValues = homeStats[statType] || [];
                        const awayStatValues = awayStats[statType] || [];

                        // Get the first value for each team (most stats have single values)
                        const homeValue =
                          homeStatValues.length > 0
                            ? homeStatValues[0].value
                            : 0;
                        const awayValue =
                          awayStatValues.length > 0
                            ? awayStatValues[0].value
                            : 0;

                        // Special rendering for Possession with visual bars
                        if (statType.toLowerCase().includes("possession")) {
                          const total = homeValue + awayValue;
                          const homePercent = total > 0 ? (homeValue / total) * 100 : 50;
                          const awayPercent = total > 0 ? (awayValue / total) * 100 : 50;

                          return (
                            <div key={statType} className="stat-row possession-row">
                              <div className="possession-stat">
                                <div className="possession-header">
                                  <span className="possession-value home">{homeValue}%</span>
                                  <span className="stat-name">{statType}</span>
                                  <span className="possession-value away">{awayValue}%</span>
                                </div>
                                <div className="possession-bars">
                                  <div
                                    className="possession-bar home"
                                    style={{ width: `${homePercent}%` }}
                                    title={`${homeTeamName}: ${homeValue}%`}
                                  />
                                  <div
                                    className="possession-bar away"
                                    style={{ width: `${awayPercent}%` }}
                                    title={`${awayTeamName}: ${awayValue}%`}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div key={statType} className="stat-row">
                            <div
                              className="stat-value home"
                              title={`${homeTeamName}: ${homeValue}`}
                            >
                              {homeValue || 0}
                            </div>
                            <div className="stat-name">
                              {statType.replace(/([A-Z])/g, " $1").trim()}
                            </div>
                            <div
                              className="stat-value away"
                              title={`${awayTeamName}: ${awayValue}`}
                            >
                              {awayValue || 0}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === "table" && (
          <div className="tab-panel table-panel">
            <div className="table-content">
              {loadingStandings ? (
                <div className="standings-loading">
                  <p>Loading standings...</p>
                </div>
              ) : standings && standings.length > 0 ? (
                <div className="standings-section">
                  {standings.map((standing) => {
                    const homeTeamId = matchSnapshot?.teams?.home?.team_id;
                    const awayTeamId = matchSnapshot?.teams?.away?.team_id;

                    return (
                      <div key={standing._id} className="standings-table-container">
                        <h3>{standing.league_name}</h3>
                        {standing.season_name && (
                          <p className="season-name">{standing.season_name}</p>
                        )}
                        <table className="standings-table">
                          <thead>
                            <tr>
                              <th>Pos</th>
                              <th>Team</th>
                              <th>P</th>
                              <th>W</th>
                              <th>D</th>
                              <th>L</th>
                              <th>GF</th>
                              <th>GA</th>
                              <th>GD</th>
                              <th>Pts</th>
                              <th>Form</th>
                            </tr>
                          </thead>
                          <tbody>
                            {standing.table && standing.table.map((entry) => {
                              const isHomeTeam = homeTeamId && String(entry.participant_id) === String(homeTeamId);
                              const isAwayTeam = awayTeamId && String(entry.participant_id) === String(awayTeamId);
                              const rowClass = isHomeTeam ? 'home-team-row' : isAwayTeam ? 'away-team-row' : '';

                              return (
                                <tr
                                  key={entry.participant_id}
                                  className={rowClass}
                                >
                                  <td>{entry.position}</td>
                                  <td className="team-name-cell">
                                    {entry.team_image && (
                                      <img
                                        src={entry.team_image}
                                        alt={entry.team_name}
                                        className="team-logo-small"
                                      />
                                    )}
                                    <span>{entry.team_name || `Team #${entry.participant_id}`}</span>
                                  </td>
                                  <td>{entry.played}</td>
                                  <td>{entry.won}</td>
                                  <td>{entry.drawn}</td>
                                  <td>{entry.lost}</td>
                                  <td>{entry.goals_for}</td>
                                  <td>{entry.goals_against}</td>
                                  <td>{entry.goal_difference > 0 ? '+' : ''}{entry.goal_difference}</td>
                                  <td><strong>{entry.points}</strong></td>
                                  <td className="form-cell">
                                    {entry.form && entry.form.map((result, idx) => (
                                      <span
                                        key={idx}
                                        className={`form-badge form-${result.toLowerCase()}`}
                                      >
                                        {result}
                                      </span>
                                    ))}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="standings-unavailable">
                  <p>League table not available for this match</p>
                </div>
              )}
            </div>
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
  );
}
