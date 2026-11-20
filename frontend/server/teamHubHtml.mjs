import React from 'react';
import { renderToString } from 'react-dom/server.edge';
import { projectTeamHubData, TeamHubSummary } from '../src/components/TeamHubSummary.mjs';
import { normalizeDirectoryTeams } from '../src/components/TeamDirectoryContent.mjs';
import { toPublicTeamSlug } from '../src/utils/teamSlug.js';

const reserved = new Set([
  'teams', 'news', 'fixtures', 'account', 'admin', 'subscription', 'followed-fixtures',
  'privacy-policy', 'cookie-policy', 'terms-of-service', 'attribution-copyright-policy',
  'league', 'sitemaps', 'robots.txt', 'sitemap.xml',
]);

export async function renderTeamHubHtml({ request, env, next }, fetchApi = fetch) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/([a-z0-9-]+)\/?$/i);
  if (['thereplay.app', 'www.thereplay.app'].includes(url.hostname) ||
      env.ENABLE_TEAM_HUB_SSR === 'false' || request.method !== 'GET' ||
      !match || reserved.has(match[1].toLowerCase())) return next();

  const response = await next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  const slug = match[1].toLowerCase();
  const apiBase = (env.STAGING_API_BASE || 'https://virtuous-exploration-staging.up.railway.app').replace(/\/$/, '');
  const fetchJson = async path => {
    const result = await fetchApi(`${apiBase}${path}`, {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) throw new Error(`Team hub API returned ${result.status} for ${path}`);
    return result.json();
  };
  try {
    const coverage = await fetchJson('/api/teams/coverage');
    const covered = normalizeDirectoryTeams(coverage?.teams).some(team =>
      toPublicTeamSlug(team.slug, team.name) === slug);
    if (!covered) return response;
    const [team, fixtures] = await Promise.all([
      fetchJson(`/api/teams/${encodeURIComponent(slug)}`),
      fetchJson(`/api/teams/${encodeURIComponent(slug)}/fixtures`),
    ]);
    if (toPublicTeamSlug(team?.slug, team?.name) !== slug) throw new Error('Team hub response does not match request');
    const data = projectTeamHubData(team, fixtures);
    const heading = renderToString(React.createElement('h1', null, data.team.name));
    const markup = renderToString(React.createElement(TeamHubSummary, { data, slug }));
    const snapshot = JSON.stringify({ data, slug }).replace(/</g, '\\u003c');
    const html = await response.text();
    const root = '<div id="root"></div>';
    if (!html.includes(root) || !html.includes('</head>')) throw new Error('Team hub HTML template is missing its root or head');
    const guard = '<style>html.team-hub-js #team-hub-depot{display:none}</style><script>document.documentElement.classList.add("team-hub-js")</script>';
    const island = `<main id="team-hub-depot">${heading}<div id="team-hub-island">${markup}</div></main><script id="team-hub-initial-data" type="application/json">${snapshot}</script>`;
    const headers = new Headers(response.headers);
    for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified']) headers.delete(name);
    headers.set('Cache-Control', 'no-store');
    return new Response(html.replace('</head>', `${guard}</head}`)
      .replace('<noscript>You need to enable JavaScript to run this app.</noscript>',
        '<noscript>Enable JavaScript for the full team hub experience.</noscript>')
      .replace(root, `${island}${root}`), {
      status: response.status, headers,
    });
  } catch (error) {
    console.error('Team hub server rendering failed:', error);
    return new Response('Team hub temporarily unavailable', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
