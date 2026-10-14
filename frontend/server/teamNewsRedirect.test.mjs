import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';

function context(path, method = 'GET') {
  return {
    request: new Request(`https://thereplay.app${path}`, { method }),
    env: {},
    next: async () => new Response('SPA HTML', { headers: { 'content-type': 'text/plain' } }),
  };
}

test('old team-news URLs permanently redirect to same-origin folders for GET and HEAD', async () => {
  for (const method of ['GET', 'HEAD']) {
    const ctx = context('/news?team=southampton', method);
    ctx.next = () => assert.fail('Redirect must not fetch HTML or match schema');
    const response = await onRequest(ctx);
    assert.equal(response.status, 301);
    assert.equal(response.headers.get('location'), 'https://thereplay.app/southampton/news');
  }
});

test('redirects preserve other query parameters, remove repeated team parameters and do not loop', async () => {
  const response = await onRequest(context('/news/?team=southampton&team=arsenal&utm_source=email'));
  assert.equal(response.headers.get('location'), 'https://thereplay.app/southampton/news?utm_source=email');
  const followup = await onRequest(context('/southampton/news?utm_source=email'));
  assert.equal(followup.status, 200);
  assert.equal(await followup.text(), 'SPA HTML');
});

test('general news, unrelated routes and write requests are unchanged', async () => {
  for (const [path, method] of [
    ['/news', 'GET'], ['/news?team=', 'GET'], ['/news?league=9', 'GET'],
    ['/arsenal/news', 'GET'], ['/account?team=southampton', 'GET'],
    ['/news?team=southampton', 'POST'],
  ]) {
    const response = await onRequest(context(path, method));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
  }
});

test('malformed query values cannot redirect to external or injected paths', async () => {
  for (const team of ['//example.com', '../admin', 'a/b', 'a?b', 'a#b', 'a\r\nb']) {
    const response = await onRequest(context(`/news?team=${encodeURIComponent(team)}`));
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('location'), null);
  }
});

test('staging redirects stay on the staging origin', async () => {
  const ctx = context('/news?team=west-ham-united');
  ctx.request = new Request('https://staging.example.com/news?team=west-ham-united');
  const response = await onRequest(ctx);
  assert.equal(response.headers.get('location'), 'https://staging.example.com/west-ham-united/news');
});
