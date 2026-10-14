export async function serveSitemap({ request, env, next }, fetchSitemap = fetch) {
  const url = new URL(request.url);
  const isSitemap = url.pathname === '/sitemap.xml'
    || /^\/sitemaps\/[^/]+$/.test(url.pathname);
  if (!isSitemap || !['GET', 'HEAD'].includes(request.method)) return next();
  if (url.pathname !== '/sitemap.xml'
    && !/^\/sitemaps\/(teams|matches|reports|pages)\.xml$/.test(url.pathname)) {
    return new Response('Unknown sitemap', { status: 404 });
  }
  const production = ['thereplay.app', 'www.thereplay.app'].includes(url.hostname);
  const apiBase = env.API_BASE || env.REACT_APP_API_BASE || (production
    ? 'https://virtuous-exploration-production.up.railway.app'
    : 'https://virtuous-exploration-staging.up.railway.app');
  try {
    const response = await fetchSitemap(`${apiBase.replace(/\/$/, '')}/api${url.pathname}`, {
      headers: { Accept: 'application/xml' }, signal: AbortSignal.timeout(10000)
    });
    if (!response.ok || !response.headers.get('content-type')?.includes('application/xml')) {
      throw new Error(`Sitemap backend returned ${response.status} or non-XML content`);
    }
    const xml = await response.text();
    return new Response(request.method === 'HEAD' ? null : xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60',
        'X-Content-Type-Options': 'nosniff',
        ...(!production ? { 'X-Robots-Tag': 'noindex' } : {})
      }
    });
  } catch (error) {
    console.error('Sitemap proxy failed:', error);
    return new Response('Sitemap temporarily unavailable', {
      status: 503, headers: { 'Cache-Control': 'no-store' }
    });
  }
}
