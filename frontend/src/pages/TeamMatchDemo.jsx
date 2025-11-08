// src/pages/TeamMatchDemo.jsx
import React from 'react';
import { useParams } from 'react-router-dom';
import { useTeamMatchInfo } from '../hooks/useTeamMatchInfo';
import MatchInfoCard from '../components/MatchInfoCard/MatchInfoCard';
import TeamMatchSummary from '../components/TeamMatchSummary/TeamMatchSummary';

/**
 * Demo page to showcase the new team match components
 * Access via /:teamSlug/demo
 */
const TeamMatchDemo = () => {
  const { teamSlug } = useParams();
  const { team, loading, error, usingCurrentData, refetch } = useTeamMatchInfo(teamSlug);

  if (!teamSlug) {
    return <div>No team slug provided</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <h1>Error Loading Team Data</h1>
        <p>{error}</p>
        <button onClick={refetch}>Retry</button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1>Team Match Info Demo: {team?.name || teamSlug}</h1>
        <p>
          This page demonstrates the new dynamic team match info components.
          Data is fetched in real-time based on the current date.
        </p>
        
        {!loading && (
          <div style={{ 
            padding: '10px', 
            background: usingCurrentData ? '#d4edda' : '#fff3cd',
            border: `1px solid ${usingCurrentData ? '#c3e6cb' : '#ffeaa7'}`,
            borderRadius: '4px',
            color: usingCurrentData ? '#155724' : '#856404',
            marginTop: '10px'
          }}>
            <strong>Data Source:</strong> {usingCurrentData ? 'Live Dynamic API' : 'Cached Snapshot'}
            {team?._computed_at && (
              <span> | Computed: {new Date(team._computed_at).toLocaleString()}</span>
            )}
            <button 
              onClick={refetch} 
              style={{ 
                marginLeft: '10px', 
                padding: '4px 8px', 
                fontSize: '0.8em',
                background: 'transparent',
                border: '1px solid currentColor',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Refresh
            </button>
          </div>
        )}
      </header>

      {loading ? (
        <div>
          <h2>Loading...</h2>
          <p>Fetching team match information...</p>
        </div>
      ) : (
        <>
          <section style={{ marginBottom: '40px' }}>
            <h2>Full Match Info Cards</h2>
            <p>These are the detailed match cards used on the main team page:</p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
              <div>
                <h3>Last Match</h3>
                <MatchInfoCard
                  matchInfo={team?.last_match_info}
                  teamName={team?.name}
                  teamSlug={teamSlug}
                  type="last"
                  showLinks={true}
                />
              </div>
              
              <div>
                <h3>Next Match</h3>
                <MatchInfoCard
                  matchInfo={team?.next_match_info}
                  teamName={team?.name}
                  teamSlug={teamSlug}
                  type="next"
                  showLinks={true}
                />
              </div>
            </div>
          </section>

          <section style={{ marginBottom: '40px' }}>
            <h2>Compact Match Summary</h2>
            <p>This is a compact version suitable for dashboards, team lists, etc.:</p>
            
            <div style={{ maxWidth: '400px', marginTop: '20px' }}>
              <TeamMatchSummary 
                teamSlug={teamSlug} 
                teamName={team?.name}
                showTitle={true}
              />
            </div>
          </section>

          <section>
            <h2>Raw Data (Debug)</h2>
            <details>
              <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>
                Click to view raw team data
              </summary>
              <pre style={{ 
                background: '#f8f9fa', 
                padding: '15px', 
                borderRadius: '4px', 
                overflow: 'auto',
                fontSize: '0.8em',
                marginTop: '10px'
              }}>
                {JSON.stringify(team, null, 2)}
              </pre>
            </details>
          </section>
        </>
      )}
    </div>
  );
};

export default TeamMatchDemo;