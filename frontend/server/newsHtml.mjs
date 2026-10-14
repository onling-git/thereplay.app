import {
  NEWS_LIST_LIMIT, normalizeNewsCollection, buildNewsCollectionSchema, newsPageUrl, serializeNewsData,
} from '../src/utils/newsCollection.mjs';

const escapeHtml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

export async function renderNewsHtml({ request, env, next }, fetchNews = fetch) {
  const url = new URL(request.url);
  const route = url.pathname.match(/^\/(?:([a-z0-9-]+)\/)?news\/?$/i);
  if (request.method !== 'GET' || !route) return next();
  const response = await next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  const teamSlug = route[1] || null;
  const pageUrl = newsPageUrl(teamSlug);
  const production = ['thereplay.app', 'www.thereplay.app'].includes(url.hostname);
  const apiBase = env.API_BASE || env.REACT_APP_API_BASE || (production
    ? 'https://virtuous-exploration-production.up.railway.app'
    : 'https://virtuous-exploration-staging.up.railway.app');
  try {
    const upstream = await fetchNews(
      `${apiBase.replace(/\/$/, '')}/api/news${teamSlug ? `/team/${encodeURIComponent(teamSlug)}` : ''}?limit=${NEWS_LIST_LIMIT}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
    );
    if (!upstream.ok) throw new Error(`News API returned ${upstream.status}`);
    const collection = normalizeNewsCollection(await upstream.json());
    const schema = buildNewsCollectionSchema({ teamSlug, ...collection });
    const heading = teamSlug ? `${teamSlug.replace(/-/g, ' ')} News` : 'Football News';
    const links = collection.articles.slice(0, NEWS_LIST_LIMIT).map(article =>
      `<li><a href="${escapeHtml(article.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(article.title || 'Read article')}</a></li>`
    ).join('');
    const content = `<main class="news-page"><h1>${escapeHtml(heading)}</h1><p>Showing ${Math.min(collection.total, NEWS_LIST_LIMIT)} of the latest articles.</p>${links ? `<ol>${links}</ol>` : '<p>No football news articles found.</p>'}</main>`;
    const head = `<link rel="canonical" data-news-canonical href="${pageUrl}"><script id="news-structured-data" data-page-url="${pageUrl}" type="application/ld+json">${serializeNewsData(schema)}</script>`;
    const snapshot = `<script id="news-initial-data" type="application/json">${serializeNewsData({ pageUrl, ...collection })}</script>`;
    const html = await response.text();
    if (!html.includes('</head>') || !html.includes('<div id="root"></div>')) {
      throw new Error('News HTML template is missing head or root');
    }
    const headers = new Headers(response.headers);
    for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified']) headers.delete(name);
    headers.set('Cache-Control', 'no-store');
    return new Response(html.replace('</head>', `${head}</head>`)
      .replace('<div id="root"></div>', `<div id="root">${content}</div>${snapshot}`), {
      status: response.status, headers,
    });
  } catch (error) {
    console.error('News server rendering failed:', error.message);
    return new Response('News temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
