import React from 'react';
import { renderToString } from 'react-dom/server.edge';
import { normalizeDirectoryTeams, TeamDirectoryContent } from '../src/components/TeamDirectoryContent.mjs';

export async function renderTeamDirectoryHtml({ request, env, next }, fetchCoverage = fetch) {
  const url = new URL(request.url);
  const production = ['thereplay.app', 'www.thereplay.app'].includes(url.hostname);
  if ((!production && !url.hostname.endsWith('.pages.dev')) || env.ENABLE_TEAM_DIRECTORY_SSR === 'false' ||
      request.method !== 'GET' || !/^\/teams\/?$/.test(url.pathname)) {
    return next();
  }

  const response = await next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;

  try {
    const apiBase = production
      ? env.PRODUCTION_API_BASE || 'https://virtuous-exploration-production.up.railway.app'
      : env.STAGING_API_BASE || 'https://virtuous-exploration-staging.up.railway.app';
    const upstream = await fetchCoverage(`${apiBase.replace(/\/$/, '')}/api/teams/coverage`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    });
    if (!upstream.ok) throw new Error(`Team coverage API returned ${upstream.status}`);
    const data = await upstream.json();
    const teams = normalizeDirectoryTeams(data?.teams);
    const markup = renderToString(React.createElement(TeamDirectoryContent, { teams }));
    const snapshot = JSON.stringify(teams).replace(/</g, '\\u003c');
    const html = await response.text();
    const root = '<div id="root"></div>';
    if (!html.includes(root)) throw new Error('Team directory HTML template is missing its root');
    const island = `<div id="team-directory-depot"><div id="team-directory-island">${markup}</div></div><script id="team-directory-initial-data" type="application/json">${snapshot}</script>`;
    const headers = new Headers(response.headers);
    for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified']) headers.delete(name);
    headers.set('Cache-Control', 'no-store');
    return new Response(html.replace(root, `${root}${island}`), { status: response.status, headers });
  } catch (error) {
    console.error('Team directory server rendering failed:', error);
    return new Response('Team directory temporarily unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
