import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serveSitemap } from './sitemapProxy.mjs';

const context = (path, method = 'GET', hostname = 'thereplay.app', env = {}) => ({
  request: new Request(`https://${hostname}${path}`, { method }),
  env, next: () => new Response('SPA')
});
const xml = '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';

test('all five public endpoints proxy backend XML instead of SPA HTML', async () => {
  for (const path of ['/sitemap.xml', ...['teams', 'matches', 'reports', 'pages'].map(type => `/sitemaps/${type}.xml`)]) {
    const response = await serveSitemap(context(path), async (url, options) => {
      assert.equal(url, `https://virtuous-exploration-production.up.railway.app/api${path}`);
      assert.equal(options.headers.Accept, 'application/xml');
      return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
    });
    assert.equal(response.status, 200);
    assert.equal(await response.text(), xml);
    assert.equal(response.headers.get('cache-control'), 'public, max-age=60');
  }
});

test('HEAD returns no body, configured API bases work and previews stay noindex', async () => {
  const response = await serveSitemap(context('/sitemap.xml', 'HEAD', 'preview.pages.dev', {
    API_BASE: 'https://backend.example/'
  }), async url => {
    assert.equal(url, 'https://backend.example/api/sitemap.xml');
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
  });
  assert.equal(await response.text(), '');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex');
});

test('unknown names return 404 without fetching, unrelated and write requests pass through', async () => {
  const never = () => { throw new Error('Should not fetch'); };
  assert.equal((await serveSitemap(context('/sitemaps/unknown.xml'), never)).status, 404);
  assert.equal(await (await serveSitemap(context('/news'), never)).text(), 'SPA');
  assert.equal(await (await serveSitemap(context('/sitemap.xml', 'POST'), never)).text(), 'SPA');
});

test('upstream failures and non-XML responses fail explicitly and are not cached', async t => {
  const logger = t.mock.method(console, 'error', () => {});
  for (const upstream of [
    async () => new Response('unavailable', { status: 503 }),
    async () => new Response('<html>SPA</html>', { headers: { 'Content-Type': 'text/html' } }),
    async () => { throw new Error('timeout'); }
  ]) {
    const response = await serveSitemap(context('/sitemap.xml'), upstream);
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
  assert.equal(logger.mock.calls.length, 3);
});

test('real Pages middleware serves sitemaps and robots keeps the requested indexing block', async t => {
  const { readFile } = await import('node:fs/promises');
  const { onRequest } = await import('../functions/_middleware.js');
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(xml, { headers: { 'Content-Type': 'application/xml' } }));
  const response = await onRequest(context('/sitemap.xml'));
  assert.equal(await response.text(), xml);
  const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');
  assert.equal((robots.match(/^Sitemap:/gm) || []).length, 1);
  assert.match(robots, /Sitemap: https:\/\/thereplay.app\/sitemap.xml/);
  assert.match(robots, /Disallow: \//);
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /name="robots" content="noindex/);
});
