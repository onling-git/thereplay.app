import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { getTeamCoverage } from '../api';
import { normalizeDirectoryTeams, TeamDirectoryContent } from '../components/TeamDirectoryContent.mjs';
import './css/teamDirectory.css';

export default function TeamDirectory() {
  const host = useRef(null);
  const island = typeof document !== 'undefined' ? document.getElementById('team-directory-island') : null;
  const [teams, setTeams] = useState([]);
  const [status, setStatus] = useState(island ? 'server' : 'loading');
  const [attempt, setAttempt] = useState(0);

  useLayoutEffect(() => {
    if (!island || !host.current) return;
    host.current.appendChild(island);
    island.hidden = false;
    return () => {
      island.hidden = true;
      document.getElementById('team-directory-depot')?.appendChild(island);
    };
  }, [island]);

  useEffect(() => {
    if (island) return;
    let active = true;
    setStatus('loading');
    getTeamCoverage().then(response => {
      const normalized = normalizeDirectoryTeams(response?.teams);
      if (active) {
        setTeams(normalized);
        setStatus('ready');
      }
    }).catch(error => {
      console.error('Failed to load team directory:', error);
      if (active) setStatus('error');
    });
    return () => { active = false; };
  }, [attempt, island]);

  return (
    <div ref={host}>
      {status === 'loading' && <div className="team-directory"><p role="status">Loading teams...</p></div>}
      {status === 'error' && <div className="team-directory" role="alert">
        <p>We couldn't load the team directory. Please try again.</p>
        <button type="button" onClick={() => setAttempt(value => value + 1)}>Try again</button>
      </div>}
      {status === 'ready' && <TeamDirectoryContent teams={teams} />}
    </div>
  );
}
