import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderTeamHubHtml } from './teamHubHtml.mjs';
import { onRequest } from '../functions/_middleware.js';

const team = {
  name: 'Southampton', slug: 'southampton', venue: { name: "St Mary's" },
  story: { content: 'First paragraph.\n\nSecond paragraph.' }, privateField: 'do-not-embed',
};
const fixtures = {
  recent: [{
    match_id: 123, date: '2026-01-01T12:00:00Z',
    teams: { home: { team_name: 'Arsenal', team_slug: 'arsenal' }, away: { team_name: 'Southampton' } },
    score: { home: 2, away: 1 }, privateField: 'do-not-embed',
  }],
  upcoming: [{
    match_id: 456, date: '2026-01-10T12:00:00Z',
    teams: { home: { team_name: 'Southampton', team_slug: 'southampton' }, away: { team_name: 'Chelsea' } },
    score: { home: 0, away: 0 },
  }],
};
const ctx = (url = 'https://staging.thereplay-app.pages.dev/southampton', env = {}) => ({
  request: new Request(url),
  env,
  next: async () => new Response('<html><head></head><body><div id="root"></div></body></html>', {
    headers: { 'content-type': 'text/html', etag: 'old', 'content-length': '1' },
  }),
});
const upstream = mock.fn(async url => {
  if (url.endsWith('/coverage')) return Response.json({ teams: [team] });
  if (url.endsWith('/fixtures')) return Response.json(fixtures);
  if (url.endsWith('/southampton')) return Response.json(team);
  throw new Error(`Unexpected request: ${url}`);
});

test('renders real public team content and canonical fixture links in initial HTML', async () => {
  upstream.mock.resetCalls();
  const response = await renderTeamHubHtml(ctx(), upstream);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /<h1>Southampton<\/h1>/);
  assert.match(html, /St Mary&#x27;s/);
  assert.match(html, /First paragraph\./);
  assert.match(html, /href="\/arsenal\/match\/123">Arsenal 2–1 Southampton/);
  assert.match(html, /href="\/southampton\/match\/456">Southampton v Chelsea/);
  assert.match(html, /href="\/southampton\/news"/);
  assert.match(html, /href="\/teams"/);
  assert.ok(html.indexOf('id="team-hub-depot"') < html.indexOf('id="root"'));
  assert.match(html, /html\.team-hub-js #team-hub-depot\{display:none\}/);
  assert.ok(!html.includes('do-not-embed'));
  const bootstrap = JSON.parse(html.match(/<script id="team-hub-initial-data" type="application\/json">(.*?)<\/script>/)[1]);
  assert.equal(bootstrap.data.team.name, 'Southampton');
  assert.equal(bootstrap.data.recent[0].id, 123);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('etag'), null);
  assert.equal(response.headers.get('content-length'), null);
  assert.equal(upstream.mock.calls.length, 3);
  assert.ok(upstream.mock.calls.every(call => call.arguments[0].startsWith('https://virtuous-exploration-staging.up.railway.app/')));
});

test('production, flag, other paths and methods bypass SSR without API requests', async () => {
  for (const context of [
    ctx('https://thereplay.app/southampton'),
    ctx('https://www.thereplay.app/southampton'),
    ctx(undefined, { ENABLE_TEAM_HUB_SSR: 'false' }),
    ctx('https://preview.pages.dev/teams'),
    ctx('https://preview.pages.dev/news'),
    ctx('https://preview.pages.dev/southampton/news'),
    { ...ctx(), request: new Request('https://preview.pages.dev/southampton', { method: 'HEAD' }) },
  ]) {
    const fetchApi = mock.fn();
    assert.equal((await renderTeamHubHtml(context, fetchApi)).status, 200);
    assert.equal(fetchApi.mock.calls.length, 0);
  }
});

test('unsupported single-segment paths pass through unchanged', async () => {
  const fetchApi = mock.fn(async () => Response.json({ teams: [team] }));
  const response = await renderTeamHubHtml(ctx('https://preview.pages.dev/unknown'), fetchApi);
  assert.doesNotMatch(await response.text(), /team-hub-island/);
  assert.equal(fetchApi.mock.calls.length, 1);
});

test('escapes content in HTML and bootstrap and uses staging override', async () => {
  const hostile = { ...team, story: { content: '</script><script>alert(1)</script>' } };
  const fetchApi = mock.fn(async url => url.endsWith('/coverage')
    ? Response.json({ teams: [team] }) : url.endsWith('/fixtures')
      ? Response.json(fixtures) : Response.json(hostile));
  const response = await renderTeamHubHtml(ctx(undefined, { STAGING_API_BASE: 'https://staging-api.example/' }), fetchApi);
  const html = await response.text();
  assert.ok(!html.includes('</script><script>alert'));
  assert.match(html, /&lt;\/script&gt;/);
  assert.ok(fetchApi.mock.calls.every(call => call.arguments[0].startsWith('https://staging-api.example/')));
});

test('upstream failures, mismatched teams and invalid fixtures return explicit 503', async t => {
  t.mock.method(console, 'error', () => {});
  for (const fetchApi of [
    async () => new Response('error', { status: 500 }),
    async () => Response.json({ teams: null }),
    async () => Response.json({ teams: [{ slug: 'southampton' }] }),
    async url => url.endsWith('/coverage') ? Response.json({ teams: [team] })
      : url.endsWith('/fixtures') ? Response.json(fixtures) : Response.json({ ...team, slug: 'other' }),
    async url => url.endsWith('/coverage') ? Response.json({ teams: [team] })
      : url.endsWith('/fixtures') ? Response.json({ recent: [{}], upcoming: [] }) : Response.json(team),
  ]) {
    assert.equal((await renderTeamHubHtml(ctx(), fetchApi)).status, 503);
  }
});

test('Pages middleware includes team content and preserves preview noindex', async t => {
  t.mock.method(globalThis, 'fetch', upstream);
  const response = await onRequest(ctx());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(await response.text(), /Southampton overview/);
});
