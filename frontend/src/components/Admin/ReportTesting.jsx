// components/Admin/ReportTesting.jsx
// Admin tool to load a match by ID and regenerate its report on demand,
// so report-generation changes can be tested locally without waiting for a real match.
// Supports a "staging" draft that can be regenerated freely without touching the
// live report a visitor would see, until it's explicitly promoted.
import React, { useState, useCallback } from 'react';
import * as adminApi from '../../api/adminApi';
import ReportContent from '../ReportContent/ReportContent';
import './ReportTesting.css';

const DEFAULT_MATCH_ID = '19729157';

function slugify(name) {
  return String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function ReportTesting() {
  const [matchIdInput, setMatchIdInput] = useState(DEFAULT_MATCH_ID);
  const [match, setMatch] = useState(null);
  const [side, setSide] = useState('home'); // 'home' | 'away'
  const [viewMode, setViewMode] = useState('live'); // 'live' | 'staging'
  const [liveReport, setLiveReport] = useState(null);
  const [stagingReport, setStagingReport] = useState(null);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [loadingReport, setLoadingReport] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [drafting, setDrafting] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState('');
  const [lastGeneratedMs, setLastGeneratedMs] = useState(null);

  const homeSlug = match ? (match.home_team_slug || match.teams?.home?.team_slug || slugify(match.home_team || match.teams?.home?.team_name)) : null;
  const awaySlug = match ? (match.away_team_slug || match.teams?.away?.team_slug || slugify(match.away_team || match.teams?.away?.team_name)) : null;
  const teamSlug = side === 'home' ? homeSlug : awaySlug;
  const homeName = match?.home_team || match?.teams?.home?.team_name || 'Home';
  const awayName = match?.away_team || match?.teams?.away?.team_name || 'Away';

  const loadReportsForSide = useCallback(async (slug, matchId) => {
    if (!slug) return;
    setLoadingReport(true);
    setError('');
    try {
      const [liveResult, stagingResult] = await Promise.allSettled([
        adminApi.getTeamMatchReport(slug, matchId),
        adminApi.getStagingReport(matchId, slug)
      ]);
      setLiveReport(liveResult.status === 'fulfilled' ? (liveResult.value?.report || null) : null);
      setStagingReport(stagingResult.status === 'fulfilled' ? (stagingResult.value?.report || null) : null);
      setViewMode('live');
    } finally {
      setLoadingReport(false);
    }
  }, []);

  const handleLoadMatch = useCallback(async () => {
    const matchId = matchIdInput.trim();
    if (!matchId) return;
    setLoadingMatch(true);
    setError('');
    setMatch(null);
    setLiveReport(null);
    setStagingReport(null);
    try {
      const doc = await adminApi.getMatchById(matchId);
      setMatch(doc);
      const slug = doc.home_team_slug || doc.teams?.home?.team_slug || slugify(doc.home_team || doc.teams?.home?.team_name);
      setSide('home');
      await loadReportsForSide(slug, matchId);
    } catch (e) {
      setError(e.message || 'Failed to load match');
    } finally {
      setLoadingMatch(false);
    }
  }, [matchIdInput, loadReportsForSide]);

  const handleSideChange = useCallback(async (newSide) => {
    setSide(newSide);
    const slug = newSide === 'home' ? homeSlug : awaySlug;
    await loadReportsForSide(slug, matchIdInput.trim());
  }, [homeSlug, awaySlug, matchIdInput, loadReportsForSide]);

  const handleRegenerateLive = useCallback(async () => {
    if (!teamSlug || !match) return;
    setRegenerating(true);
    setError('');
    const started = Date.now();
    try {
      const result = await adminApi.regenerateMatchReport(match.match_id, teamSlug, { debug: true });
      setLiveReport(result.report);
      setViewMode('live');
      setLastGeneratedMs(Date.now() - started);
    } catch (e) {
      setError(e.message || 'Failed to regenerate report');
    } finally {
      setRegenerating(false);
    }
  }, [teamSlug, match]);

  const handleGenerateStaging = useCallback(async () => {
    if (!teamSlug || !match) return;
    setDrafting(true);
    setError('');
    const started = Date.now();
    try {
      const result = await adminApi.generateStagingReport(match.match_id, teamSlug, { debug: true });
      setStagingReport(result.report);
      setViewMode('staging');
      setLastGeneratedMs(Date.now() - started);
    } catch (e) {
      setError(e.message || 'Failed to generate staging draft');
    } finally {
      setDrafting(false);
    }
  }, [teamSlug, match]);

  const handlePromoteStaging = useCallback(async () => {
    if (!teamSlug || !match) return;
    setPromoting(true);
    setError('');
    try {
      const result = await adminApi.promoteStagingReport(match.match_id, teamSlug);
      setLiveReport(result.report);
      setViewMode('live');
    } catch (e) {
      setError(e.message || 'Failed to promote staging draft');
    } finally {
      setPromoting(false);
    }
  }, [teamSlug, match]);

  const displayedReport = viewMode === 'staging' ? stagingReport : liveReport;

  return (
    <div className="report-testing">
      <div className="report-testing-section-header">
        <h2>Report Testing</h2>
      </div>
      <p className="report-testing-hint">
        Load any finished match by ID and generate a staging draft to test report-generation
        changes locally without affecting the live report visitors see. Promote the draft once
        you're happy with it.
      </p>

      <div className="report-testing-controls">
        <label htmlFor="match-id-input">Match ID</label>
        <input
          id="match-id-input"
          type="text"
          value={matchIdInput}
          onChange={(e) => setMatchIdInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleLoadMatch()}
          placeholder="e.g. 19729157"
        />
        <button onClick={handleLoadMatch} disabled={loadingMatch}>
          {loadingMatch ? 'Loading…' : 'Load Match'}
        </button>
      </div>

      {error && <p className="report-testing-error">{error}</p>}

      {match && (
        <>
          <div className="report-testing-match-summary">
            <div className="report-testing-match-title">
              {homeName} vs {awayName}
              {match.score && (match.score.home != null) && (
                <span> ({match.score.home}-{match.score.away})</span>
              )}
            </div>
            <div className="report-testing-match-meta">
              Match ID: {match.match_id} • Status: {match.match_status?.short_name || match.status || 'unknown'}
            </div>
          </div>

          <div className="report-testing-side-toggle">
            <button
              className={side === 'home' ? 'active' : ''}
              onClick={() => handleSideChange('home')}
            >
              {homeName} report
            </button>
            <button
              className={side === 'away' ? 'active' : ''}
              onClick={() => handleSideChange('away')}
            >
              {awayName} report
            </button>
          </div>

          <div className="report-testing-view-toggle">
            <button
              className={viewMode === 'live' ? 'active' : ''}
              onClick={() => setViewMode('live')}
            >
              Live report
            </button>
            <button
              className={viewMode === 'staging' ? 'active' : ''}
              onClick={() => setViewMode('staging')}
            >
              Staging draft{stagingReport ? '' : ' (none yet)'}
            </button>
          </div>

          <div className="report-testing-actions">
            <button
              className="staging-button"
              onClick={handleGenerateStaging}
              disabled={drafting || !teamSlug}
            >
              {drafting ? 'Generating draft…' : 'Generate Staging Draft'}
            </button>
            <button
              className="promote-button"
              onClick={handlePromoteStaging}
              disabled={promoting || !stagingReport}
              title={!stagingReport ? 'Generate a staging draft first' : 'Copy the staging draft into the live report'}
            >
              {promoting ? 'Promoting…' : 'Promote Draft to Live'}
            </button>
            <button
              className="regenerate-button"
              onClick={handleRegenerateLive}
              disabled={regenerating || !teamSlug}
              title="Regenerates the live report directly - skips the staging step"
            >
              {regenerating ? 'Regenerating…' : 'Regenerate Live Report'}
            </button>
            {teamSlug && <span className="report-testing-slug">team slug: {teamSlug}</span>}
            {lastGeneratedMs != null && (
              <span className="report-testing-timing">generated in {lastGeneratedMs}ms</span>
            )}
          </div>

          <div className="report-testing-preview">
            {loadingReport ? (
              <p>Loading report…</p>
            ) : displayedReport ? (
              <>
                {viewMode === 'staging' && <div className="report-testing-staging-badge">Staging draft — not visible to visitors</div>}
                <ReportContent report={displayedReport} />
              </>
            ) : (
              <p className="report-testing-empty">
                {viewMode === 'staging'
                  ? 'No staging draft yet. Click "Generate Staging Draft" to create one.'
                  : 'No live report generated yet for this side.'}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
