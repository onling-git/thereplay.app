const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { parseStringPromise } = require('xml2js');
const Team = require('./models/Team');
const Match = require('./models/Match');
const Report = require('./models/Report');
const Snapshot = require('./models/NewsCollectionSnapshot');
const { recordNewsSnapshot } = require('./utils/newsSitemapSnapshot');
const { entriesFor, sitemapIndex, sitemapXml, matchLastmod, lastmod } = require('./utils/sitemap');

const now = new Date('2026-10-14T10:00:00Z');
const teams = [{ slug: 'southampton', name: 'Southampton' }, { slug: 'portsmouth', name: 'Portsmouth' }];
const fixture = overrides => ({
  match_id: 19729063, createdAt: '2026-09-01T10:00:00Z',
  match_info: { starting_at: '2026-10-11T11:00:00Z' },
  teams: { home: { team_slug: 'southampton', team_name: 'Southampton' },
    away: { team_slug: 'portsmouth', team_name: 'Portsmouth' } },
  match_status: { short_name: 'NS' }, ...overrides
});

test('index contains exactly the four requested children and no timestamps or nested indexes', async () => {
  const parsed = await parseStringPromise(sitemapIndex());
  assert.equal(parsed.sitemapindex.$.xmlns, 'http://www.sitemaps.org/schemas/sitemap/0.9');
  assert.deepEqual(parsed.sitemapindex.sitemap.map(item => item.loc[0]), [
    'https://thereplay.app/sitemaps/teams.xml', 'https://thereplay.app/sitemaps/matches.xml',
    'https://thereplay.app/sitemaps/reports.xml', 'https://thereplay.app/sitemaps/pages.xml'
  ]);
  assert.doesNotMatch(sitemapIndex(), /lastmod|priority|changefreq/);
});

test('team hubs and news use trustworthy dates, not cache updates or the generation time', () => {
  const entries = entriesFor('teams', {
    teams: [...teams, { slug: 'admin', name: 'Not public' }, { slug: 'bad/slug', name: 'Invalid' },
      { slug: 'arsenal', name: 'Arsenal', updatedAt: now, story: {
        status: 'published', published_at: '2026-09-01', updated_at: '2026-09-02'
      } }],
    snapshots: [{ path: '/southampton/news', newest_published_at: '2026-10-11T15:00:00Z' }]
  }, now);
  assert.equal(entries.length, 6);
  assert.equal(entries.find(entry => entry.loc.endsWith('/southampton')).lastmod, null);
  assert.equal(entries.find(entry => entry.loc.endsWith('/southampton/news')).lastmod, '2026-10-11T15:00:00.000Z');
  assert.equal(entries.find(entry => entry.loc.endsWith('/arsenal')).lastmod, '2026-09-02T00:00:00.000Z');
});

test('match freshness changes at kickoff and full-time but not on live polling', () => {
  const match = fixture();
  assert.equal(matchLastmod(match, new Date('2026-10-10')), '2026-09-01T10:00:00.000Z');
  assert.equal(matchLastmod(match, now), '2026-09-01T10:00:00.000Z');
  match.match_status.short_name = 'POSTP';
  assert.equal(matchLastmod(match, now), '2026-09-01T10:00:00.000Z');
  match.match_status.short_name = '1H';
  match.periods = [{ started: Date.parse('2026-10-11T11:03:00Z') / 1000 }];
  const live = matchLastmod(match, now);
  assert.equal(live, '2026-10-11T11:03:00.000Z');
  match.updatedAt = now;
  match.periods.push({ started: Date.parse('2026-10-11T12:05:00Z') / 1000 });
  assert.equal(matchLastmod(match, now), live);
  match.match_status.short_name = 'FT';
  match.periods[1].ended = Date.parse('2026-10-11T12:55:00Z') / 1000;
  assert.equal(matchLastmod(match, now), '2026-10-11T12:55:00.000Z');
  match.structured_data_frozen_at = '2026-10-11T12:56:00Z';
  assert.equal(matchLastmod(match, now), '2026-10-11T12:56:00.000Z');
});

test('matches include actual scheduled fixtures once at their canonical home URL', () => {
  const valid = fixture({ match_info: { starting_at: '2026-10-17T11:00:00Z' } });
  const entries = entriesFor('matches', { teams, matches: [
    valid, valid, fixture({ match_id: 0 }), fixture({ teams: {} }),
    fixture({ match_info: { starting_at: 'invalid' } })
  ] }, now);
  const xml = sitemapXml(entries);
  assert.equal((xml.match(/<url>/g) || []).length, 1);
  assert.match(xml, /https:\/\/thereplay.app\/southampton\/match\/19729063/);
  assert.doesNotMatch(xml, /\/live|\/portsmouth\/match/);
});

test('reports include both published perspectives, exclude unlinked/other-team reports and use edit timestamps', () => {
  const match = fixture({ reports: { home: 'r1', away: 'r2' } });
  const reports = [
    { _id: 'r1', match_id: match.match_id, team_slug: 'southampton', headline: 'Saints win',
      createdAt: '2026-10-11T14:00:00Z', updatedAt: '2026-10-12T14:00:00Z', match },
    { _id: 'r2', match_id: match.match_id, team_slug: 'portsmouth', headline: 'Pompey fall short',
      createdAt: '2026-10-11T14:01:00Z', match },
    { _id: 'unlinked', match_id: match.match_id, team_slug: 'southampton', headline: 'Preview', match },
    { _id: 'r1', match_id: match.match_id, team_slug: 'portsmouth', headline: 'Wrong perspective', match }
  ];
  const entries = entriesFor('reports', { teams, reports }, now);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].lastmod, '2026-10-12T14:00:00.000Z');
  assert.ok(entries[1].loc.endsWith('/portsmouth/match/19729063/report'));
});

test('static pages exclude private routes and omit unknown/future/invalid lastmod', () => {
  const entries = entriesFor('pages', {}, now);
  assert.deepEqual(entries.map(entry => new URL(entry.loc).pathname),
    ['/', '/news', '/fixtures', '/privacy-policy', '/terms-of-service']);
  assert.doesNotMatch(sitemapXml(entries), /lastmod|priority|changefreq|account|admin/);
  for (const value of [undefined, null, '', 'not a date', '2027-01-01']) assert.equal(lastmod(value, now), null);
});

test('XML escapes content, has deterministic ordering, deduplicates and respects both protocol limits', async () => {
  const entries = [{ loc: 'https://thereplay.app/z?x=1&y=<value>"\'' }, { loc: 'https://thereplay.app/a' }];
  const xml = sitemapXml([...entries, entries[0]]);
  assert.equal(sitemapXml([...entries].reverse()), xml);
  const parsed = await parseStringPromise(xml);
  assert.equal(parsed.urlset.$.xmlns, 'http://www.sitemaps.org/schemas/sitemap/0.9');
  assert.equal(parsed.urlset.url[1].loc[0], entries[0].loc);
  const many = Array.from({ length: 50000 }, (_, i) => ({ loc: `https://thereplay.app/${i}` }));
  assert.equal((sitemapXml(many).match(/<url>/g) || []).length, 50000);
  assert.throws(() => sitemapXml([...many, { loc: 'https://thereplay.app/extra' }]), /50,000/);
  assert.throws(() => sitemapXml([{ loc: `https://thereplay.app/${'a'.repeat(50 * 1024 * 1024)}` }]), /50 MB/);
});

test('news snapshot uses actual provider/report dates, ignores fabricated fallback now and nondefault limits', async t => {
  const writes = t.mock.method(Snapshot, 'updateOne', async () => ({}));
  await recordNewsSnapshot('/southampton/news', [
    { kind: 'match-report', url: '/southampton/match/1/report', published_at: '2026-09-02T10:00:00Z' },
    { url: 'https://example.com/story', published_at: new Date(), source_published_at: '2026-09-03T10:00:00Z' }
  ], 20);
  assert.equal(writes.mock.calls[0].arguments[1].$set.newest_published_at.toISOString(), '2026-09-03T10:00:00.000Z');
  await recordNewsSnapshot('/news', [{ url: 'https://example.com/undated', published_at: new Date() }], 20);
  assert.equal(writes.mock.calls[1].arguments[1].$set.newest_published_at, null);
  await recordNewsSnapshot('/news', [], 20);
  assert.equal(writes.mock.calls[2].arguments[1].$set.newest_published_at, null);
  await recordNewsSnapshot('/news', [], 5);
  assert.equal(writes.mock.calls.length, 3);
});

test('RSS and Atom parser provenance preserves genuine dates without trusting missing-date fallbacks', () => {
  const { parseRssItem, parseAtomEntry } = require('./utils/rssAggregator');
  const feed = { id: 'test', name: 'Test' };
  const dated = '2026-09-01T10:00:00Z';
  assert.equal(parseRssItem({ link: 'https://example.com/story', pubDate: dated }, feed, 1).source_published_at, dated);
  assert.equal(parseRssItem({ link: 'https://example.com/story' }, feed, 1).source_published_at, null);
  assert.equal(parseAtomEntry({ link: 'https://example.com/story', published: dated }, feed, 1).source_published_at, dated);
  assert.equal(parseAtomEntry({ link: 'https://example.com/story' }, feed, 1).source_published_at, null);
});

test('news snapshots exclude invalid URLs and omit freshness if visible items are invalidly or future dated', async t => {
  const writes = t.mock.method(Snapshot, 'updateOne', async () => ({}));
  t.mock.method(console, 'warn', () => {});
  const real = { url: 'https://example.com/story', source_published_at: '2026-09-01T10:00:00Z' };
  await recordNewsSnapshot('/news', [real, { url: 'javascript:alert(1)' }], 20);
  assert.equal(writes.mock.calls[0].arguments[1].$set.newest_published_at.toISOString(), '2026-09-01T10:00:00.000Z');
  for (const source_published_at of ['invalid', '2099-01-01']) {
    await recordNewsSnapshot('/news', [{ ...real, source_published_at }], 20);
    assert.equal(writes.mock.calls.at(-1).arguments[1].$set.newest_published_at, null);
  }
});

test('actual backend routes return XML, current database data, 404 and explicit failures', async t => {
  let currentTeams = teams;
  let fail = false;
  t.mock.method(Team, 'find', () => ({ lean: async () => {
    if (fail) throw new Error('DB unavailable');
    return currentTeams;
  } }));
  t.mock.method(Match, 'find', () => ({ lean: async () => [fixture()] }));
  t.mock.method(Report, 'aggregate', async () => []);
  t.mock.method(Snapshot, 'find', () => ({ lean: async () => [] }));
  t.mock.method(console, 'error', () => {});
  const app = express();
  app.use('/api', require('./routes/sitemapRoutes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const get = path => fetch(`http://127.0.0.1:${server.address().port}/api${path}`);
  assert.equal((await get('/sitemap.xml')).status, 200);
  for (const type of ['teams', 'matches', 'reports', 'pages']) {
    const response = await get(`/sitemaps/${type}.xml`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /application\/xml/);
    await parseStringPromise(await response.text());
  }
  currentTeams = [...teams, { slug: 'arsenal', name: 'Arsenal' }];
  assert.match(await (await get('/sitemaps/teams.xml')).text(), /\/arsenal/);
  assert.equal((await get('/sitemaps/unknown.xml')).status, 404);
  fail = true;
  const response = await get('/sitemaps/teams.xml');
  assert.equal(response.status, 503);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
