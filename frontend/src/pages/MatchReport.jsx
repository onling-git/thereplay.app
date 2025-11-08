import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://virtuous-exploration-production.up.railway.app';

async function fetchJSON(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const text = await res.text(); // read raw first
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // not JSON (HTML error, etc.)
    const err = new Error(`Non-JSON response from ${path}: ${text.slice(0, 120)}…`);
    err.status = res.status;
    throw err;
  }
  if (!res.ok) {
    const err = new Error((json && (json.error || json.message)) || `HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return json;
}

export default function MatchReport() {
  const { teamSlug, matchId } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      setErr('');
      setData(null);
      try {
        const doc = await fetchJSON(`/api/${teamSlug}/match/${matchId}/report`);
        if (!alive) return;
        setData(doc);
      } catch (e) {
        if (!alive) return;
        setErr(e.message || 'Failed to load report');
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => { alive = false; };
  }, [teamSlug, matchId]);

  if (loading) return <p>Loading…</p>;

  if (err) {
    return (
      <div>
        <h1>Match Report</h1>
        <p>Report not available yet or failed to load.</p>
        <p style={{ color: '#a00' }}><small>{err}</small></p>
        <p>
          <Link to={`/${teamSlug}/match/${matchId}/live`}>Back to match</Link>{' • '}
          <Link to={`/${teamSlug}`}>Back to team overview</Link>
        </p>
      </div>
    );
  }

  console.log('Match report data:', data);
  
  // Extract match details from the API response
  const home = data?.home_team || 'Home';
  const away = data?.away_team || 'Away';
  const homeScore = data?.home_score ?? '';
  const awayScore = data?.away_score ?? '';
  const dateStr = data?.date ? new Date(data.date).toLocaleString() : '';
  const status = data?.status || '';

  // Handle both legacy string reports and new Report document objects
  const reportContent = typeof data?.report === 'string' 
    ? data.report 
    : data?.report?.content || 'No report text found.';

  // Format the score display
  const scoreDisplay = (homeScore !== '' && awayScore !== '') 
    ? ` (${homeScore}-${awayScore})` 
    : '';

  return (
    <div>
      <h1>Match Report</h1>
      <div style={{ marginBottom: '20px' }}>
        <h2><strong>{home}</strong> vs <strong>{away}</strong>{scoreDisplay}</h2>
        {dateStr && <p><small>{dateStr}</small></p>}
        {status && <p><small>Status: {status}</small></p>}
      </div>
      <article style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
        {reportContent}
      </article>
      <p>
        <Link to={`/${teamSlug}/match/${matchId}/live`}>Back to match</Link>{' • '}
        <Link to={`/${teamSlug}`}>Back to team overview</Link>
      </p>
    </div>
  );
}
