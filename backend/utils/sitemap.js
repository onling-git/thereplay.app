const { isFinalMatch, matchPageUrl } = require('./liveMatchSchema');

const SITE_URL = 'https://thereplay.app';
const TYPES = ['teams', 'matches', 'reports', 'pages'];
const MAX_URLS = 50000;
const MAX_BYTES = 50 * 1024 * 1024;
const RESERVED = new Set([
  'news', 'fixtures', 'account', 'admin', 'subscription', 'followed-fixtures',
  'privacy-policy', 'terms-of-service', 'league', 'sitemaps'
]);
const PUBLIC_PAGES = ['/', '/news', '/fixtures', '/privacy-policy', '/terms-of-service'];
const escapeXml = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

function validSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && !RESERVED.has(slug);
}

function lastmod(value, now = new Date()) {
  if (value == null || value === '') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date <= now ? date.toISOString() : null;
}

function latest(values, now) {
  return values.map(value => lastmod(value, now)).filter(Boolean).sort().at(-1);
}

function matchLastmod(match, now) {
  const kickoff = match.match_info?.starting_at || match.date;
  const starts = (match.periods || []).filter(period => period.started)
    .map(period => new Date(period.started * 1000));
  const firstStart = starts.sort((a, b) => a - b)[0];
  const status = match.match_status;
  const code = String(status?.developer_name || status?.short_name || status?.state || status || '')
    .trim().toLowerCase().replace(/[ -]+/g, '_');
  const hasBegun = isFinalMatch(match) || [
    'live', '1h', '2h', 'ht', 'et', 'inplay_1st_half', 'inplay_2nd_half',
    'inplay_half_time', 'extra_time', 'penalties'
  ].includes(code);
  const base = lastmod(firstStart || (hasBegun ? kickoff : null), now) || lastmod(match.createdAt, now);
  if (!isFinalMatch(match)) return base;
  const ends = (match.periods || []).filter(period => period.ended)
    .map(period => new Date(period.ended * 1000));
  return latest([...ends, match.structured_data_frozen_at, base], now);
}

function entriesFor(type, { teams = [], matches = [], reports = [], snapshots = [] }, now = new Date()) {
  const slugs = new Set(teams.filter(team => validSlug(team.slug) && team.name).map(team => team.slug));
  const newsDates = new Map(snapshots.map(snapshot => [snapshot.path, snapshot.newest_published_at]));
  if (type === 'teams') {
    return teams.filter(team => slugs.has(team.slug)).flatMap(team => [
      // updatedAt is also bumped by cache jobs; it is not an editorial timestamp.
      { loc: `${SITE_URL}/${team.slug}`, lastmod: team.story?.status === 'published'
        ? latest([team.story.published_at, team.story.updated_at], now) : null },
      { loc: `${SITE_URL}/${team.slug}/news`, lastmod: lastmod(newsDates.get(`/${team.slug}/news`), now) }
    ]);
  }
  if (type === 'matches') {
    return matches.filter(match =>
      Number.isSafeInteger(match.match_id) && match.match_id > 0
      && slugs.has(match.teams?.home?.team_slug)
      && match.teams?.home?.team_name && match.teams?.away?.team_name
      && Number.isFinite(new Date(match.match_info?.starting_at || match.date).getTime())
    ).map(match => ({ loc: matchPageUrl(match), lastmod: matchLastmod(match, now) }));
  }
  if (type === 'reports') {
    return reports.filter(report => slugs.has(report.team_slug)
      && Number.isSafeInteger(report.match_id) && report.match_id > 0
      && (report.generated?.headline?.trim() || report.headline?.trim())
      && ['home', 'away'].some(side => report.match?.teams?.[side]?.team_slug === report.team_slug
        && String(report.match?.reports?.[side] || '') === String(report._id))
    ).map(report => ({
      loc: `${SITE_URL}/${report.team_slug}/match/${report.match_id}/report`,
      lastmod: latest([report.createdAt, report.updatedAt], now)
    }));
  }
  if (type === 'pages') {
    return PUBLIC_PAGES.map(path => ({ loc: `${SITE_URL}${path}`,
      lastmod: path === '/news' ? lastmod(newsDates.get(path), now) : null }));
  }
  throw new Error(`Unknown sitemap type: ${type}`);
}

function sitemapIndex() {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${TYPES.map(type =>
    `  <sitemap><loc>${SITE_URL}/sitemaps/${type}.xml</loc></sitemap>`
  ).join('\n')}\n</sitemapindex>\n`;
}

function sitemapXml(entries) {
  const urls = [...new Map(entries.map(entry => [entry.loc, entry])).values()]
    .sort((a, b) => a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0);
  if (urls.length > MAX_URLS) throw new Error('Sitemap exceeds 50,000 URLs; split by season');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(entry =>
    `  <url><loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${escapeXml(entry.lastmod)}</lastmod>` : ''}</url>`
  ).join('\n')}\n</urlset>\n`;
  if (Buffer.byteLength(xml, 'utf8') > MAX_BYTES) throw new Error('Sitemap exceeds 50 MB; split by season');
  return xml;
}

module.exports = { TYPES, entriesFor, sitemapIndex, sitemapXml, lastmod, matchLastmod };
