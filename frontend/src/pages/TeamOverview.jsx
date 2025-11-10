// src/pages/TeamOverview.jsx
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getLastMatchForTeam } from "../api";

import { useTeamMatchInfo } from "../hooks/useTeamMatchInfo";
import MatchInfoCard from "../components/MatchInfoCard/MatchInfoCard";
import Header from "../components/Header/Header";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";

import "../components/LiveScoreCards/livescorecards.css";

import "./css/teamoverview.css";

const StatusBadge = ({ status }) => {
  // status may be an object (match.match_status) or a string
  const code = status?.developer_name ?? status?.state ?? status ?? "unknown";
  const cls = `status-badge status-${code}`;
  const label = code === "live" ? "LIVE" : (code === "finished" || code === "FT") ? "FT" : "UPCOMING";
  return <span className={cls}>{label}</span>;
};

const TeamOverview = () => {
  const { teamSlug } = useParams(); // route should be /:teamSlug
  const { team, loading: loadingTeam, error, usingCurrentData } = useTeamMatchInfo(teamSlug);
  const [match, setMatch] = useState(null);
  const [loadingMatch, setLoadingMatch] = useState(true);

  useEffect(() => {
    if (!teamSlug) return;
    setLoadingMatch(true);
    getLastMatchForTeam(teamSlug)
      .then(setMatch)
      .catch((err) => {
        // 404 is expected when no matches exist
        if (err.status === 404) setMatch(null);
        else console.warn("Failed to fetch legacy match data:", err.body || err.message);
      })
      .finally(() => setLoadingMatch(false));
  }, [teamSlug]);

  if (!teamSlug) return <div>No team slug in URL</div>;
  if (error) return <div>Error: {String(error)}</div>;

  console.log("[match] JSON:", match);

  return (
    <div className="team-overview">
      <Header />
      
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
        <>
          <h1>{team?.name || teamSlug}</h1>
          {team?.image_path && (
            <img src={team.image_path} alt={`${team.name} badge`} />
          )}
        </>
      )}

      <section className="team-matches">
        {/* Data freshness indicator */}
        {!loadingTeam && team && (
          <div className={`data-freshness ${usingCurrentData ? 'current' : 'cached'}`}>
            {usingCurrentData ? '✅ Live data' : '⚠️ Cached data'}
            {team._computed_at && ` (updated: ${new Date(team._computed_at).toLocaleTimeString()})`}
            {/* Show which approach is being used */}
            {process.env.NODE_ENV === 'development' && (
              <div style={{ fontSize: '0.8em', opacity: 0.7, marginTop: '4px' }}>
                Using: {team.last_match_info || team.next_match_info ? 'legacy match_info' : 'match IDs'}
                {team.last_match && ` (last: ${team.last_match})`}
                {team.next_match && ` (next: ${team.next_match})`}
              </div>
            )}
          </div>
        )}

        <div className="matches-grid">
          <div className="match-section">
            <h2>Last Match</h2>
            {loadingTeam ? (
              <div className="match-info-card empty">
                <p>Loading team data...</p>
              </div>
            ) : (
              <MatchInfoCard
                matchInfo={team?.last_match_info}
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
                matchInfo={team?.next_match_info}
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
        {process.env.NODE_ENV === 'development' && (
          <details style={{ marginTop: '30px', opacity: 0.6 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
              🔧 Debug: Legacy Match Data
            </summary>
            <div style={{ marginTop: '10px', padding: '10px', background: '#f8f9fa', borderRadius: '4px' }}>
              {loadingMatch && <p>Loading legacy match...</p>}
              {!loadingMatch && !match && <p>No legacy match data available.</p>}
              {match && (
                <div>
                  <p>
                    <strong>Legacy API result:</strong><br />
                    {new Date(match.date).toLocaleString()} — {match.home_team}{" "}
                    {match.score?.home ?? "-"} : {match.score?.away ?? "-"}{" "}
                    {match.away_team}
                  </p>
                </div>
              )}
            </div>
          </details>
        )}
        <div>
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

                  {/* {match.teams.home.team_name} vs {match.teams.away.team_name} */}
                </p>
              </div>

              <div className="live-score-card-body">
                <div>
                  <div className="live-score-card-team">
                    <div className="live-score-card-team-info">
                      {/* {match.home_logo && (
                          <img
                            className="live-score-card-logo"
                            src={match.home_logo}
                            alt={match.home_team}
                          />
                        )} */}
                      {/* <p>{match.teams.home.team_name}</p> */}
                    </div>

                    <p className="live-score-card-score-value">
                      {/* {match.score?.home ?? "-"} */}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {/* <LiveScoreCards /> */}
        </div>
      </section>
      {/* <FooterNav /> */}
    </div>
  );
};

export default TeamOverview;
