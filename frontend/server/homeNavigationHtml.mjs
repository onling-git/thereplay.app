import React from 'react';
import { renderToString } from 'react-dom/server.edge';
import { LegalLinksContent } from '../src/components/LegalLinks/LegalLinksContent.mjs';

export async function renderHomeNavigationHtml({ request, env, next }) {
  const url = new URL(request.url);
  const production = ['thereplay.app', 'www.thereplay.app'].includes(url.hostname);
  if ((!production && !url.hostname.endsWith('.pages.dev')) ||
      env.ENABLE_TEAM_DIRECTORY_SSR === 'false' || request.method !== 'GET' || url.pathname !== '/') {
    return next();
  }
  const response = await next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  const html = await response.text();
  const root = '<div id="root"></div>';
  if (!html.includes(root)) {
    console.error('Home navigation server rendering failed: missing root');
    return new Response('Home navigation temporarily unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
  const markup = renderToString(React.createElement(LegalLinksContent));
  const island = `<div id="legal-links-depot"><div id="legal-links-island">${markup}</div></div>`;
  const headers = new Headers(response.headers);
  for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified']) headers.delete(name);
  headers.set('Cache-Control', 'no-store');
  return new Response(html.replace(root, `${root}${island}`), { status: response.status, headers });
}
