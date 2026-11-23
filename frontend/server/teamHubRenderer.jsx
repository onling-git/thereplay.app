import React from 'react';
import { renderToString } from 'react-dom/server.edge';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { parseDocument } from 'htmlparser2';
import { textContent } from 'domutils';
import { AuthProvider } from '../src/contexts/AuthContext';
import { SubscriptionProvider } from '../src/contexts/SubscriptionContext';
import { AdSenseProvider } from '../src/contexts/AdSenseContext';
import TeamOverview from '../src/pages/TeamOverview';
import { normalizeDirectoryTeams } from '../src/components/TeamDirectoryContent.mjs';
import { toPublicTeamSlug } from '../src/utils/teamSlug';

const RESERVED = new Set([
  'teams', 'news', 'fixtures', 'account', 'admin', 'subscription', 'followed-fixtures',
  'privacy-policy', 'cookie-policy', 'terms-of-service', 'attribution-copyright-policy',
]);

function plainText(value) {
  const document = parseDocument(String(value || ''));
  const blocks = new Set(['p', 'div', 'br', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote']);
  const visit = node => {
    if (['script', 'style', 'template'].includes(node.name)) return '';
    if (!node.children) return textContent(node);
    const text = node.children.map(visit).join('');
    return blocks.has(node.name) ? ` ${text} ` : text;
  };
  return visit(document).replace(/\s+/g, ' ').trim();
}

export async function renderTeamHubHtml({ request, env, next }, fetchApi = fetch) {
  const url = new URL(request.url);
  const match = url.pathname.match(/^\/([a-z0-9-]+)\/?$/i);
  const production = ['thereplay.app', 'www.thereplay.app'].includes(url.hostname);
  if ((!production && !url.hostname.endsWith('.pages.dev')) ||
      env.ENABLE_TEAM_HUB_SSR === 'false' || request.method !== 'GET' ||
      !match || RESERVED.has(match[1].toLowerCase())) return next();

  const response = await next();
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return response;
  const slug = match[1].toLowerCase();
  const apiBase = (production
    ? env.PRODUCTION_API_BASE || 'https://virtuous-exploration-production.up.railway.app'
    : env.STAGING_API_BASE || 'https://virtuous-exploration-staging.up.railway.app').replace(/\/$/, '');
  const read = async path => {
    const result = await fetchApi(`${apiBase}${path}`, {
      headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) throw new Error(`Team hub API ${path}: ${result.status}`);
    return result.json();
  };
  try {
    const coverage = await read('/api/teams/coverage');
    if (!normalizeDirectoryTeams(coverage?.teams).some(team => toPublicTeamSlug(team.slug, team.name) === slug)) return response;
    const team = await read(`/api/teams/${encodeURIComponent(slug)}`);
    if (!team?.id || !team?.name || toPublicTeamSlug(team.slug, team.name) !== slug) throw new Error('Invalid team response');
    const [fixtures, standings, competitions, statistics, news, discussions, tweets, nextMatch] = await Promise.all([
      read(`/api/teams/${slug}/fixtures`),
      read(`/api/standings/team/${encodeURIComponent(team.id)}`),
      read(`/api/teams/${slug}/competitions`),
      read(`/api/teams/${slug}/statistics`),
      read(`/api/news/team/${slug}?limit=4`),
      read(`/api/teams/${slug}/hub/discussions?page=1&limit=5&sort=active`),
      read(`/api/tweets/team/${slug}?feedType=team_feed&limit=20`),
      team.next_match ? read(`/api/matches/${encodeURIComponent(team.next_match)}`) : Promise.resolve(null),
    ]);
    const articles = Array.isArray(news) ? news : news?.data || news?.articles;
    if (!Array.isArray(fixtures?.recent) || !Array.isArray(fixtures?.upcoming) ||
        !Array.isArray(standings?.data) || !Array.isArray(competitions?.competitions) ||
        !Array.isArray(statistics?.statistics) || !Array.isArray(articles) ||
        !Array.isArray(discussions?.data?.discussions) || !Array.isArray(tweets?.tweets)) {
      throw new Error('Invalid team hub data');
    }
    const initialHub = {
      team, fixtures, standings: standings.data, competitions: competitions.competitions,
      statistics: statistics.statistics, nextMatch,
      articles: articles.map(article => ({ ...article, summary_plain: plainText(article.summary) })),
      discussions: discussions.data.discussions,
      tweets: tweets.tweets.map(tweet => ({
        ...tweet, plainText: plainText(tweet.isRetweet && tweet.retweetedTweet?.text ? tweet.retweetedTweet.text : tweet.text),
      })),
    };
    const markup = renderToString(
      <MemoryRouter initialEntries={[`/${slug}`]}>
        <AuthProvider><SubscriptionProvider><AdSenseProvider>
          <Routes><Route path="/:teamSlug" element={<TeamOverview initialHub={initialHub} />} /></Routes>
        </AdSenseProvider></SubscriptionProvider></AuthProvider>
      </MemoryRouter>
    );
    const html = await response.text();
    const root = '<div id="root"></div>';
    if (!html.includes(root) || !html.includes('</head>')) throw new Error('Team hub template missing root or head');
    const guard = '<style>html.team-hub-js #team-hub-static{display:none}</style><script>document.documentElement.classList.add("team-hub-js")</script>';
    const content = `<main id="team-hub-static" class="page-content">${markup}</main>`;
    const headers = new Headers(response.headers);
    for (const name of ['content-length', 'content-encoding', 'etag', 'last-modified']) headers.delete(name);
    headers.set('Cache-Control', 'no-store');
    return new Response(html.replace('</head>', `${guard}</head>`)
      .replace('<noscript>You need to enable JavaScript to run this app.</noscript>', '<noscript>Enable JavaScript for the full interactive experience.</noscript>')
      .replace(root, `${content}${root}`), { status: response.status, headers });
  } catch (error) {
    console.error('Team hub server rendering failed:', error);
    return new Response('Team hub temporarily unavailable', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
