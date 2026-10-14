export const NEWS_LIST_LIMIT = 20;
const SITE_URL = 'https://thereplay.app';

export function newsPageUrl(teamSlug) {
  return `${SITE_URL}${teamSlug ? `/${encodeURIComponent(teamSlug)}` : ''}/news`;
}

export function normalizeNewsCollection(response) {
  const raw = Array.isArray(response) ? response : response?.data || response?.articles;
  if (!Array.isArray(raw)) throw new Error('Invalid news collection response');
  const articles = raw.filter(article => {
    try {
      if (typeof article?.url !== 'string' || !article.url.trim()) throw new Error('Missing article URL');
      const url = new URL(article.url, SITE_URL);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        throw new Error('Unsupported article URL');
      }
      return true;
    } catch {
      console.warn('Omitting news item with an invalid article URL:', article?.id);
      return false;
    }
  }).map(article => ({ ...article, url: new URL(article.url, SITE_URL).href }));
  articles.sort((a, b) => {
    const aDate = Date.parse(a.published_at) || 0;
    const bDate = Date.parse(b.published_at) || 0;
    if (aDate !== bDate) return bDate - aDate;
    const aKey = `${a.url}\n${a.id || ''}`;
    const bKey = `${b.url}\n${b.id || ''}`;
    return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
  });
  return { articles, total: articles.length };
}

export function buildNewsCollectionSchema({ teamSlug, articles, total }) {
  const url = newsPageUrl(teamSlug);
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${url}#webpage`,
    url,
    isPartOf: { '@id': `${SITE_URL}/#website` },
    ...(teamSlug ? { about: { '@id': `${SITE_URL}/${encodeURIComponent(teamSlug)}/` } } : {}),
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: total,
      itemListElement: articles.slice(0, NEWS_LIST_LIMIT).map((article, index) => ({
        '@type': 'ListItem', position: index + 1, url: article.url,
      })),
    },
  };
}

export function serializeNewsData(data) {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
