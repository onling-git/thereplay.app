import { useEffect } from 'react';
import { buildNewsCollectionSchema, newsPageUrl, serializeNewsData } from '../utils/newsCollection.mjs';

export default function NewsStructuredData({ teamSlug, collection, pending = false }) {
  const pageUrl = newsPageUrl(teamSlug);
  useEffect(() => {
    const existing = document.getElementById('news-structured-data');
    const existingCanonical = document.querySelector('link[data-news-canonical]');
    if (pending && existing?.getAttribute('data-page-url') === pageUrl) {
      return () => {
        existing.remove();
        existingCanonical?.remove();
      };
    }
    existing?.remove();
    existingCanonical?.remove();
    if (!collection) return;
    const script = document.createElement('script');
    script.id = 'news-structured-data';
    script.type = 'application/ld+json';
    script.setAttribute('data-page-url', pageUrl);
    script.textContent = serializeNewsData(buildNewsCollectionSchema({ teamSlug, ...collection }));
    document.head.appendChild(script);
    const canonical = document.createElement('link');
    canonical.rel = 'canonical';
    canonical.href = pageUrl;
    canonical.setAttribute('data-news-canonical', '');
    document.head.appendChild(canonical);
    return () => {
      script.remove();
      canonical.remove();
    };
  }, [teamSlug, pageUrl, collection, pending]);
  return null;
}
