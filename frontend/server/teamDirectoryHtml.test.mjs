import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderTeamDirectoryHtml } from './teamDirectoryHtml.mjs';

const teams = [
  { id: 2, name: 'Southampton', slug: 'southampton' },
  { id: 1, name: 'AFC Rushden & Diamonds', slug: 'afc-rushden--diamonds' },
];
const context = (url = 'https://preview.pages.dev/teams', enabled = true) => ({
  request: new Request(url),
  env: { ENABLE_TEAM_DIRECTORY_SSR: enabled ? 'true' : 'false' },
  next: async () => new Response('<html><head></head><body><div id="root"></div></body></html>', {
    headers: { 'content-type': 'text/html', etag: 'old', 'content-encoding': 'gzip' },
  }),
});

test('staging returns actual React HTML and safe matching hydration data', async () => {
  const fetchCoverage = mock.fn(async () => Response.json({ teams }));
  const response = await renderTeamDirectoryHtml(context(), fetchCoverage);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /id="team-directory-island">/);
  assert.match(html, /href="\/southampton">Southampton<\/a>/);
  assert.match(html, /href="\/afc-rushden-and-diamonds">AFC Rushden &amp; Diamonds<\/a>/);
  const data = JSON.parse(html.match(/<script id="team-directory-initial-data" type="application\/json">(.*?)<\/script>/)[1]);
  assert.deepEqual(data.map(team => team.name), ['AFC Rushden & Diamonds', 'Southampton']);
  assert.match(fetchCoverage.mock.calls[0].arguments[0], /staging\.up\.railway\.app\/api\/teams\/coverage$/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('etag'), null);
});

test('production, other paths and disabled flag pass through without requesting data', async () => {
  for (const ctx of [
    context('https://thereplay.app/teams'),
    context('https://www.thereplay.app/teams'),
    context('https://preview.pages.dev/teams', false),
    context('https://preview.pages.dev/news'),
  ]) {
    const fetchCoverage = mock.fn();
    assert.equal((await renderTeamDirectoryHtml(ctx, fetchCoverage)).status, 200);
    assert.equal(fetchCoverage.mock.calls.length, 0);
  }
});

test('preview SSR defaults on and remains off on production even when explicitly enabled', async () => {
  const preview = context();
  delete preview.env.ENABLE_TEAM_DIRECTORY_SSR;
  const fetchCoverage = mock.fn(async () => Response.json({ teams }));
  assert.match(await (await renderTeamDirectoryHtml(preview, fetchCoverage)).text(), /id="team-directory-island"/);
  const production = context('https://thereplay.app/teams');
  await renderTeamDirectoryHtml(production, fetchCoverage);
  assert.equal(fetchCoverage.mock.calls.length, 1);
});

test('escapes untrusted content in both markup and bootstrap data', async () => {
  const response = await renderTeamDirectoryHtml(context(), async () =>
    Response.json({ teams: [{ id: 1, slug: 'test', name: '</script><script>alert(1)</script>' }] }));
  const html = await response.text();
  assert.ok(!html.includes('</script><script>alert'));
  assert.match(html, /&lt;\/script&gt;/);
});

test('failed or malformed upstream responses return an explicit failure', async t => {
  t.mock.method(console, 'error', () => {});
  for (const fetchCoverage of [
    async () => new Response('offline', { status: 500 }),
    async () => Response.json({ teams: null }),
    async () => { throw new Error('timeout'); },
  ]) {
    assert.equal((await renderTeamDirectoryHtml(context(), fetchCoverage)).status, 503);
  }
});
