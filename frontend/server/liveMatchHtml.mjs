export async function renderLiveMatchHtml({ request, env, next }, fetchSchema = fetch) {
  const url = new URL(request.url);
  const route = url.pathname.match(/^\/([a-z0-9-]+)\/match\/([0-9]+)(?:\/live)?\/?$/i);
  if (request.method !== 'GET' || !route) return next();

  const response = await next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;

  const production = ['thereplay.app', 'www.thereplay.app'].includes(url.hostname);
  const apiBase = env.API_BASE || env.REACT_APP_API_BASE || (
    production ? 'https://virtuous-exploration-production.up.railway.app'
      : 'https://virtuous-exploration-staging.up.railway.app'
  );
  try {
    const schemaResponse = await fetchSchema(
      `${apiBase.replace(/\/$/, '')}/api/${encodeURIComponent(route[1])}/match/${route[2]}/schema`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) }
    );
    if (!schemaResponse.ok) {
      console.error('Live match HTML schema request failed:', schemaResponse.status);
      return new Response(response.body, {
        status: schemaResponse.status === 404 ? 404 : 503,
        headers: { ...Object.fromEntries(response.headers), 'Cache-Control': 'no-store' },
      });
    }
    const { graph, matchUrl } = await schemaResponse.json();
    if (!graph?.['@graph'] || !matchUrl?.startsWith('https://thereplay.app/')) {
      throw new Error('Invalid live match schema response');
    }
    const json = JSON.stringify(graph).replace(/</g, '\\u003c');
    const canonicalUrl = matchUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
    const html = await response.text();
    const markup = `<link rel="canonical" data-live-match-canonical href="${canonicalUrl}"><script id="live-match-structured-data" data-match-id="${route[2]}" type="application/ld+json">${json}</script>`;
    if (!html.includes('</head>')) throw new Error('Live match HTML has no head closing tag');
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.delete('etag');
    headers.delete('last-modified');
    headers.set('Cache-Control', 'no-store');
    return new Response(html.replace('</head>', `${markup}</head>`), { status: response.status, headers });
  } catch (error) {
    console.error('Live match server HTML rendering failed:', error);
    return new Response('Match page temporarily unavailable', { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
