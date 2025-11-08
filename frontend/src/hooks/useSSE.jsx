// src/hooks/useSSE.js
import { useEffect, useRef, useState } from 'react';

export default function useSSE(url, { retryMs = 5000 } = {}) {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('idle'); // 'idle'|'connecting'|'open'|'error'
  const esRef = useRef(null);
  const urlRef = useRef(url);
  const finishedRef = useRef(false);

  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  useEffect(() => {
    if (!url) return;

    let isUnmounted = false;
    let es;
    const connect = () => {
      setStatus('connecting');
      try {
        es = new EventSource(urlRef.current, { withCredentials: false });
      } catch (err) {
        setStatus('error');
        console.error('SSE connect failed', err);
        scheduleReconnect();
        return;
      }

      es.onopen = () => {
        if (isUnmounted) return;
        esRef.current = es;
        setStatus('open');
      };

      es.onmessage = (ev) => {
        if (isUnmounted) return;
        try {
          const parsed = JSON.parse(ev.data);
          setData(parsed);
        } catch (e) {
          // if payload isn't JSON, pass raw string
          setData(ev.data);
        }
      };

      // Listen for a server-sent 'complete' event which indicates final snapshot
      es.addEventListener && es.addEventListener('complete', (ev) => {
        if (isUnmounted) return;
        finishedRef.current = true;
        try {
          const parsed = JSON.parse(ev.data);
          setData(parsed);
        } catch (e) {
          setData(ev.data);
        }
        setStatus('complete');
        try { es.close(); } catch (e) {}
      });

      es.onerror = (err) => {
        if (isUnmounted) return;
        // If the server signalled a final completion, don't reconnect
        if (finishedRef.current) return;
        setStatus('error');
        console.warn('SSE error', err);
        // close and reconnect
        try { es.close(); } catch (e) {}
        scheduleReconnect();
      };
    };

    let reconnectTimer;
    const scheduleReconnect = () => {
      if (isUnmounted) return;
      if (finishedRef.current) return;
      reconnectTimer = setTimeout(() => {
        connect();
      }, retryMs);
    };

    connect();

    return () => {
      isUnmounted = true;
      try { es && es.close(); } catch (e) {}
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [url, retryMs]);

  return { data, status };
}
