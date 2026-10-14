import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderNewsHtml } from './newsHtml.mjs';
import { buildNewsCollectionSchema, normalizeNewsCollection } from '../src/utils/newsCollection.mjs';

const articles = Array.from({ length: 25 }, (_, i) => ({
  id: i, title: `Story ${i}`, url: `https://external.example/story-${i}`,
  published_at: `2026-10-${String(i + 1).padStart(2, '0')}T12:00:00Z`,
}));
const context = path => ({
  request: new Request(`https://thereplay.app${path}`), env: {},
  next: async () => new Response('<html><head></head><body><div id="root"></div></body></html>', {
    headers: { 'content-type': 'text/html', etag: 'old', 'content-encoding': 'gzip', 'X-Robots-Tag': 'noindex' },
  }),
});
const parseScript = (html, id) => JSON.parse(html.match(new RegExp(`<script id="${id}"[^>]*>(.*?)</script>`))[1]);

test('team and general initial HTML contain exactly the same ordered links as their capped schemas', async () => {
  for (const [path, team] of [['/southampton/news', 'southampton'], ['/news', null]]) {
    const fetchNews = mock.fn(async () => Response.json(articles));
    const response = await renderNewsHtml(context(path), fetchNews);
    const html = await response.text();
    const schema = parseScript(html, 'news-structured-data');
    assert.equal(response.status, 200);
    assert.equal(schema['@type'], 'CollectionPage');
    assert.equal(schema.url, `https://thereplay.app${path}`);
    assert.equal(schema['@id'], `${schema.url}#webpage`);
    assert.equal(schema.mainEntity.numberOfItems, 25);
    assert.equal(schema.mainEntity.itemListElement.length, 20);
    const links = [...html.matchAll(/<a href="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(schema.mainEntity.itemListElement.map(item => item.url), links);
    assert.deepEqual(Object.keys(schema.mainEntity.itemListElement[0]), ['@type', 'position', 'url']);
    assert.equal(links[0], articles[24].url);
    assert.equal(schema.about?.['@id'], team ? `https://thereplay.app/${team}/` : undefined);
    assert.equal(parseScript(html, 'news-initial-data').articles.length, 25);
    assert.ok(html.includes(`rel="canonical" data-news-canonical href="${schema.url}"`));
    assert.equal(response.headers.get('etag'), null);
    assert.equal(response.headers.get('content-encoding'), null);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    assert.match(fetchNews.mock.calls[0].arguments[0], /limit=20$/);
  }
});

test('ordering is deterministic for tied or missing dates and internal reports keep their real URLs', () => {
  const input = [
    { id: 'b', url: 'https://external.example/b', published_at: '2026-10-01' },
    { id: 'a', url: '/southampton/match/19729063/report', published_at: '2026-10-01' },
    { id: 'c', url: 'https://external.example/c' },
  ];
  const first = normalizeNewsCollection(input);
  assert.deepEqual(first, normalizeNewsCollection([...input].reverse()));
  assert.deepEqual(input[1].url, '/southampton/match/19729063/report');
  const schema = buildNewsCollectionSchema({ ...first });
  assert.ok(schema.mainEntity.itemListElement.some(item => item.url === 'https://thereplay.app/southampton/match/19729063/report'));
});

test('stored text is safely escaped in HTML and bootstrap scripts', async () => {
  const response = await renderNewsHtml(context('/news'), async () => Response.json([
    { id: 1, title: '</script><script>alert(1)</script>', url: 'https://example.com/?a=1&b=2' },
  ]));
  const html = await response.text();
  assert.ok(!html.includes('</script><script>alert'));
  assert.ok(html.includes('&lt;/script&gt;'));
  assert.equal(parseScript(html, 'news-initial-data').articles[0].title, '</script><script>alert(1)</script>');
});

test('invalid URLs are omitted with logging; empty collections have honest counts', async t => {
  const log = t.mock.method(console, 'warn', () => {});
  const normalized = normalizeNewsCollection([{ id: 1, url: 'javascript:alert(1)' }, { id: 2 }, null]);
  assert.equal(log.mock.calls.length, 3);
  assert.equal(normalized.total, 0);
  const response = await renderNewsHtml(context('/news'), async () => Response.json([]));
  const schema = parseScript(await response.text(), 'news-structured-data');
  assert.deepEqual(schema.mainEntity, { '@type': 'ItemList', numberOfItems: 0, itemListElement: [] });
});

test('unknown shapes, failed upstreams and missing templates fail explicitly', async t => {
  t.mock.method(console, 'error', () => {});
  for (const fetchNews of [
    async () => new Response('offline', { status: 500 }),
    async () => Response.json({ error: 'not an array' }),
    async () => { throw new Error('timeout'); },
  ]) {
    assert.equal((await renderNewsHtml(context('/news'), fetchNews)).status, 503);
  }
  const ctx = context('/news');
  ctx.next = async () => new Response('<head></head>', { headers: { 'content-type': 'text/html' } });
  assert.equal((await renderNewsHtml(ctx, async () => Response.json([]))).status, 503);
});

test('unrelated routes pass through and configured staging API is used for news', async () => {
  const unusedFetch = mock.fn();
  await renderNewsHtml(context('/southampton/match/19729063'), unusedFetch);
  assert.equal(unusedFetch.mock.calls.length, 0);
  const ctx = context('/news');
  ctx.env.API_BASE = 'https://staging.example.com/';
  const fetchNews = mock.fn(async () => Response.json([]));
  await renderNewsHtml(ctx, fetchNews);
  assert.equal(fetchNews.mock.calls[0].arguments[0], 'https://staging.example.com/api/news?limit=20');
});
