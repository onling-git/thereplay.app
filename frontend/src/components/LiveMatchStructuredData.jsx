import { useEffect } from 'react';

export default function LiveMatchStructuredData({ graph, matchUrl, matchId, clear = false }) {
  useEffect(() => {
    const existing = document.getElementById('live-match-structured-data');
    const existingCanonical = document.querySelector('link[data-live-match-canonical]');
    if (!graph && !clear && existing?.getAttribute('data-match-id') === String(matchId)) {
      return () => {
        existing.remove();
        existingCanonical?.remove();
      };
    }
    if (existing) existing.remove();
    existingCanonical?.remove();
    if (!graph || !matchUrl) return;

    const script = document.createElement('script');
    script.id = 'live-match-structured-data';
    script.type = 'application/ld+json';
    script.setAttribute('data-match-id', String(matchId));
    script.textContent = JSON.stringify(graph).replace(/</g, '\\u003c');
    document.head.appendChild(script);

    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = matchUrl;
    canonical.setAttribute('data-live-match-canonical', '');
    document.head.appendChild(canonical);

    return () => {
      script.remove();
      canonical.remove();
    };
  }, [graph, matchUrl, matchId, clear]);

  return null;
}
