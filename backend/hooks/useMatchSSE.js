// src/hooks/useMatchSSE.js
import { useEffect, useRef, useState } from 'react';

export default function useMatchSSE(matchId, { baseUrl = 'http://localhost:8000' } = {}) {
  const [data, setData] = useState(null);      // last payload received
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const esRef = useRef(null);

  useEffect(() => {
    if (!matchId) return;

    const url = `${baseUrl}/api/stream/match/${matchId}`;
    const es = new EventSource(url, { withCredentials: false });
    esRef.current = es;

    es.onopen = () => {
      setConnected(true);
      setError(null);
    };

    es.onmessage = (evt) => {
      // default event (no name) – not used here
      try { setData(JSON.parse(evt.data)); } catch {}
    };

    es.addEventListener('init', (evt) => {
      try { setData(JSON.parse(evt.data)); } catch {}
    });

    es.addEventListener('update', (evt) => {
      try { setData(JSON.parse(evt.data)); } catch {}
    });

    es.addEventListener('error', (evt) => {
      setError('stream error');
      // EventSource auto-reconnects; you can add backoff if needed
    });

    return () => {
      es.close();
      setConnected(false);
    };
  }, [matchId, baseUrl]);

  return { data, connected, error };
}
