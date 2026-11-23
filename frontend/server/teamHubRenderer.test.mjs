import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderTeamHubHtml } from '../functions/_generated/teamHub.mjs';
import { onRequest } from '../functions/_middleware.js';

const team = { id: 65, slug: 'southampton', name: 'Southampton', venue: { name: "St Mary's" },
  story: { content: 'A club story' }, privateField: 'not-for-html' };
const recent = {
  match_id: 123, date: '2026-01-01T12:00:00Z',
  teams: { home: { team_name: 'Arsenal', team_slug: 'arsenal' }, away: { team_name: 'Southampton', team_slug: 'southampton' } },
  match_status: { state: 'FT' }, score: { home: 2, away: 1 },
};
const fixtures = { recent: [recent], upcoming: [] };
const context = (url = 'https://staging.pages.dev/southampton', env = {}) => ({
  request: new Request(url), env,
  next: async () => new Response('<html><head></head><body><div id="root"></div></body></html>', {
    headers: { 'content-type': 'text/html', etag: 'old', 'content-length': '1' },
  }),
});
const responses = url => {
  const path = new URL(url).pathname;
  if (path.endsWith('/coverage')) return { teams: [team] };
  if (path === '/api/teams/southampton') return team;
  if (path.endsWith('/fixtures')) return fixtures;
  if (path.includes('/standings/team/')) return { data: [] };
  if (path.endsWith('/competitions')) return { competitions: [] };
  if (path.endsWith('/statistics')) return { statistics: [] };
  if (path.includes('/api/news/')) return [{ id: '1', title: 'Recent match report', summary: '<p>Match <b>story</b></p>', url: 'https://example.test/article', source: 'Test', published_at: '2026-01-01T00:00:00Z' }];
  if (path.endsWith('/hub/discussions')) return { data: { discussions: [{ _id: '1', title: 'Club discussion', body: 'Fans discuss the game', createdAt: '2026-01-01', authorSnapshot: { displayName: 'Fan' }, stats: { commentCount: 0 } }] } };
  if (path.includes('/api/tweets/')) return { tweets: [] };
  throw new Error(`Unexpected API request: ${url}`);
};
const fetchApi = async url => Response.json(responses(url));

test('renders the actual hub cards, stories and links without adding an overview box', async () => {
  const result = await renderTeamHubHtml(context(), fetchApi);
  const html = await result.text();
  assert.equal(result.status, 200);
  for (const content of ['Southampton', "St Mary", 'Next Match', 'Recent Matches',
    'Upcoming Matches', 'Season Statistics', 'Latest News', 'Recent match report',
    'Club discussion', 'Fans discuss the game', 'A club story']) assert.ok(html.includes(content), content);
  assert.match(html, /href="\/southampton\/news"/);
  assert.match(html, /href="\/southampton\/community\/1"/);
  assert.match(html, /href="\/southampton\/match\/123\/report"/);
  assert.match(html, /html\.team-hub-js #team-hub-static\{display:none\}/);
  assert.doesNotMatch(html, /Southampton overview|not-for-html/);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.headers.get('etag'), null);
});

test('production uses the production API and preview uses staging', async () => {
  const productionCalls = [];
  const productionFetch = async url => {
    productionCalls.push(url);
    return Response.json(responses(url));
  };
  const production = await renderTeamHubHtml(
    context('https://thereplay.app/southampton'),
    productionFetch
  );
  assert.equal(production.status, 200);
  assert.match(await production.text(), /Recent Matches/);
  assert.ok(productionCalls.length > 0);
  assert.ok(productionCalls.every(url =>
    url.startsWith('https://virtuous-exploration-production.up.railway.app/')));

  const overrideCalls = [];
  await renderTeamHubHtml(
    context('https://www.thereplay.app/southampton', { PRODUCTION_API_BASE: 'https://production-api.example' }),
    async url => { overrideCalls.push(url); return Response.json(responses(url)); }
  );
  assert.ok(overrideCalls.length > 0);
  assert.ok(overrideCalls.every(url => url.startsWith('https://production-api.example/')));
});

test('other hosts, unrelated routes and disabled flag do not invoke APIs', async () => {
  for (const ctx of [
    context(undefined, { ENABLE_TEAM_HUB_SSR: 'false' }),
    context('https://staging.pages.dev/teams'),
    context('https://staging.pages.dev/southampton/news'),
    context('https://example.com/southampton'),
  ]) {
    const fetch = mock.fn();
    assert.equal((await renderTeamHubHtml(ctx, fetch)).status, 200);
    assert.equal(fetch.mock.calls.length, 0);
  }
});

test('uncovered paths pass through and upstream failures are explicit', async t => {
  const result = await renderTeamHubHtml(context('https://staging.pages.dev/unknown'), fetchApi);
  assert.doesNotMatch(await result.text(), /team-hub-static/);
  t.mock.method(console, 'error', () => {});
  const error = await renderTeamHubHtml(context(), async url => url.endsWith('/coverage')
    ? Response.json({ teams: [team] }) : new Response('Error', { status: 500 }));
  assert.equal(error.status, 503);
});

test('escapes public user content and strips executable markup from article summaries', async () => {
  const fetch = async url => {
    const data = responses(url);
    const path = new URL(url).pathname;
    if (path.includes('/api/news/')) data[0].summary = '<p>Safe</p><script>doNotExecute()</script><p>More</p>';
    if (path.endsWith('/hub/discussions')) data.data.discussions[0].title = '</script><script>doNotExecute()</script>';
    return Response.json(data);
  };
  const html = await (await renderTeamHubHtml(context(), fetch)).text();
  assert.match(html, /Safe More/);
  assert.doesNotMatch(html, /<script>doNotExecute/);
  assert.match(html, /&lt;script&gt;doNotExecute/);
});

test('Pages middleware enables production SSR without preview noindex and retains preview noindex', async t => {
  t.mock.method(globalThis, 'fetch', fetchApi);
  const response = await onRequest(context());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.match(await response.text(), /Recent Matches/);
  const production = await onRequest(context('https://thereplay.app/southampton'));
  assert.equal(production.status, 200);
  assert.equal(production.headers.get('x-robots-tag'), null);
  assert.match(await production.text(), /Recent Matches/);
});
