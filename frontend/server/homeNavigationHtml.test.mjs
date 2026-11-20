import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHomeNavigationHtml } from './homeNavigationHtml.mjs';

const context = (url, env = {}) => ({
  request: new Request(url),
  env,
  next: async () => new Response('<html><head></head><body><div id="root"></div></body></html>', {
    headers: { 'content-type': 'text/html', etag: 'old' },
  }),
});

test('preview home exposes the real footer and directory link in initial HTML', async () => {
  const response = await renderHomeNavigationHtml(context('https://preview.pages.dev/'));
  const html = await response.text();
  for (const path of ['/teams', '/privacy-policy', '/cookie-policy', '/terms-of-service', '/attribution-copyright-policy']) {
    assert.ok(html.includes(`href="${path}"`), path);
  }
  assert.match(html, /id="legal-links-island">/);
  assert.doesNotMatch(html, /id="legal-links-island" hidden/);
  assert.equal(response.headers.get('etag'), null);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('production, other routes and disabled previews are unchanged', async () => {
  for (const ctx of [
    context('https://thereplay.app/'),
    context('https://www.thereplay.app/'),
    context('https://preview.pages.dev/', { ENABLE_TEAM_DIRECTORY_SSR: 'false' }),
    context('https://preview.pages.dev/news'),
  ]) {
    assert.doesNotMatch(await (await renderHomeNavigationHtml(ctx)).text(), /legal-links-island/);
  }
});
