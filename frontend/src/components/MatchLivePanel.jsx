// src/components/MatchLivePanel.jsx
import React from 'react';
import useMatchSSE from '../hooks/useMatchSSE';

export default function MatchLivePanel({ matchId }) {
  const { data, connected, error } = useMatchSSE(matchId);

  if (error) return <div className="text-red-600">Live stream error: {error}</div>;
  if (!data) return <div>Connecting…</div>;

  const { score, status, minute, eventsCount, match } = data;
  return (
    <div className="p-4 border rounded-lg">
      <div className="text-sm opacity-70">
        Live: {connected ? 'connected' : 'reconnecting…'}
      </div>
      <h2 className="text-xl font-semibold">
        {match?.home_team} vs {match?.away_team}
      </h2>
      <div className="text-2xl my-2">
        {score?.home ?? 0} – {score?.away ?? 0}
      </div>
      <div className="text-sm">
        {status} {minute != null ? `• ${minute}'` : ''}
      </div>
      <div className="text-sm mt-1">
        Events: {eventsCount}
      </div>
    </div>
  );
}