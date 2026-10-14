import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { renderLiveMatchHtml } from './liveMatchHtml.mjs';

const matchUrl = 'https://thereplay.app/southampton/match/19729063';
const graph = { '@context': 'https://schema.org', '@graph': [
  { '@type': 'SportsEvent', '@id': `${matchUrl}#event`, name: '</script><script>test</script>' },
] };
const context = (path) => ({
  request: new Request(`https://thereplay.app${path}`), env: {},
  next: async () => new Response('<html><head><title>Match</title></head><body></body></html>', {
    headers: { 'content-type': 'text/html', 'X-Robots-Tag': 'noindex', etag: 'old', 'content-encoding': 'gzip' },
  }),
});

test('canonical and legacy paths render the server graph in initial HTML', async () => {
  for (const path of ['/southampton/match/19729063', '/portsmouth/match/19729063/live']) {
    const fetchSchema = mock.fn(async () => Response.json({ graph, matchUrl }));
    const response = await renderLiveMatchHtml(context(path), fetchSchema);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.ok(html.includes(`href="${matchUrl}"`));
    assert.ok(html.includes('type="application/ld+json"'));
    assert.ok(!html.includes('</script><script>test'));
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex');
    assert.equal(response.headers.get('etag'), null);
    assert.equal(response.headers.get('content-encoding'), null);
    assert.match(fetchSchema.mock.calls[0].arguments[0], /\/schema$/);
  }
});

test('other routes do not request match schema', async () => {
  const fetchSchema = mock.fn();
  for (const path of ['/southampton', '/southampton/match/19729063/report', '/static/main.js']) {
    const response = await renderLiveMatchHtml(context(path), fetchSchema);
    assert.equal(response.status, 200);
  }
  assert.equal(fetchSchema.mock.calls.length, 0);
});

test('uses the configured Pages API base for server requests', async () => {
  const ctx = context('/southampton/match/19729063');
  ctx.env.API_BASE = 'https://api.example.com/';
  const fetchSchema = mock.fn(async () => Response.json({ graph, matchUrl }));
  await renderLiveMatchHtml(ctx, fetchSchema);
  assert.equal(fetchSchema.mock.calls[0].arguments[0], 'https://api.example.com/api/southampton/match/19729063/schema');
});

test('missing matches and server failures are not returned as successful match pages', async (t) => {
  t.mock.method(console, 'error', () => {});
  for (const [upstream, expected] of [[404, 404], [500, 503]]) {
    const response = await renderLiveMatchHtml(context('/southampton/match/19729063'),
      async () => new Response('Failure', { status: upstream }));
    assert.equal(response.status, expected);
  }
  const invalid = await renderLiveMatchHtml(context('/southampton/match/19729063'),
    async () => Response.json({ schema: 'old schema' }));
  assert.equal(invalid.status, 503);
});
