const assert = require('node:assert/strict');
const { test } = require('node:test');
const xml2js = require('xml2js');
const axios = require('axios');
const RssFeed = require('./models/RssFeed');
const Team = require('./models/Team');
const { parseRssItem, parseAtomEntry, aggregateFeeds } = require('./utils/rssAggregator');

const imageUrl = 'https://example.com/photo.jpg';
const feed = { id: 'image-test', name: 'Test feed', priority: 1 };
const cases = [
  {
    name: 'media thumbnail',
    xml: `<media:thumbnail url="${imageUrl}" />`,
    expected: imageUrl
  },
  {
    name: 'repeated thumbnails',
    xml: `<media:thumbnail /><media:thumbnail url="${imageUrl}" />`,
    expected: imageUrl
  },
  {
    name: 'media content without a MIME type',
    xml: `<media:content url="${imageUrl}" />`,
    expected: imageUrl
  },
  {
    name: 'mixed video and image content',
    xml: `<media:content url="https://example.com/video.mp4" type="video/mp4" /><media:content url="${imageUrl}" type="image/jpeg" medium="image" />`,
    expected: imageUrl
  },
  {
    name: 'grouped media',
    xml: `<media:group><media:thumbnail url="${imageUrl}" /></media:group>`,
    expected: imageUrl
  },
  {
    name: 'image enclosure',
    xml: `<enclosure url="${imageUrl}" type="image/jpeg" />`,
    expected: imageUrl
  },
  {
    name: 'untyped enclosure',
    xml: `<enclosure url="${imageUrl}" />`,
    expected: imageUrl
  },
  {
    name: 'non-image media',
    xml: '<media:content url="https://example.com/video.mp4" medium="video" /><enclosure url="https://example.com/audio.mp3" type="audio/mpeg" />',
    expected: null
  },
  { name: 'no image', xml: '', expected: null }
];

for (const [format, parser] of [['RSS', parseRssItem], ['Atom', parseAtomEntry]]) {
  for (const fixture of cases) {
    test(`${format}: ${fixture.name}`, async () => {
      const parsed = await xml2js.parseStringPromise(
        `<item xmlns:media="http://search.yahoo.com/mrss/"><title>Test article</title><link>https://example.com/story</link>${fixture.xml}</item>`,
        { explicitArray: false, ignoreAttrs: false, trim: true }
      );
      assert.equal(parser(parsed.item, feed, 0).image_url, fixture.expected);
    });
  }
}

for (const links of [
  { $: { href: imageUrl, type: 'image/jpeg' } },
  [{ $: { href: 'https://example.com/story', rel: 'alternate' } }, { $: { href: imageUrl, type: 'image/jpeg' } }]
]) {
  test(`Atom: ${Array.isArray(links) ? 'multiple links' : 'single image link'}`, () => {
    assert.equal(parseAtomEntry({ title: 'Test article', link: links }, feed, 0).image_url, imageUrl);
  });
}

test('aggregation deduplicates overlapping feeds before applying the limit', async context => {
  const sharedUrl = 'https://example.com/news/portsmouth-injury';
  const uniqueUrl = 'https://example.com/news/portsmouth-tickets';
  const testFeeds = [
    { id: 'secondary', name: 'Secondary feed', url: 'https://example.com/secondary/rss', priority: 2 },
    { id: 'preferred', name: 'Preferred feed', url: 'https://example.com/preferred/rss', priority: 1 }
  ];
  const xmlItem = (url, date) => `<item><title>Portsmouth football news</title><description>Portsmouth team update.</description><link>${url}</link><pubDate>${date}</pubDate></item>`;
  const sharedItem = xmlItem(sharedUrl, 'Fri, 02 Oct 2026 12:00:00 GMT');
  const uniqueItem = xmlItem(uniqueUrl, 'Fri, 02 Oct 2026 11:00:00 GMT');
  context.mock.method(RssFeed, 'getEnabledFeeds', async () => testFeeds);
  context.mock.method(Team, 'find', () => ({ select: () => ({ lean: async () => [] }) }));
  context.mock.method(axios, 'get', async url => ({
    data: `<rss version="2.0"><channel>${url.includes('preferred') ? sharedItem + sharedItem + uniqueItem : sharedItem}</channel></rss>`
  }));

  const articles = await aggregateFeeds({ teamId: 'portsmouth', limit: 2, useCache: false });

  assert.deepEqual(articles.map(article => article.url), [sharedUrl, uniqueUrl]);
  assert.equal(articles[0].source, 'Preferred feed');
  assert.equal(articles[1].source, 'Preferred feed');
});

const sourceFeeds = [
  { _id: 'generic-source', id: 'generic', name: 'BBC Sport Football', url: 'https://example.com/generic/rss', priority: 1, scope: 'generic' },
  { _id: 'saints-source', id: 'saints', name: 'Saints News', url: 'https://example.com/saints/rss', priority: 1, scope: 'generic' },
  { _id: 'pompey-source', id: 'pompey', name: 'Portsmouth News', url: 'https://example.com/pompey/rss', priority: 1, scope: 'generic' }
];
const sourceTeams = [
  { _id: 'saints-team', id: 65, name: 'Southampton', slug: 'southampton', rssFeeds: [{ feedId: 'saints-source' }] },
  { _id: 'pompey-team', id: 89, name: 'Portsmouth', slug: 'portsmouth', rssFeeds: [{ feedId: 'pompey-source' }] }
];

function mockNewsSources(context, feeds = sourceFeeds, teams = sourceTeams) {
  context.mock.method(RssFeed, 'getEnabledFeeds', async () => feeds);
  context.mock.method(Team, 'find', () => ({ select: () => ({ lean: async () => teams }) }));
  return context.mock.method(axios, 'get', async url => {
    const items = url.includes('/generic/')
      ? [['Southampton squad update', 'https://example.com/news/saints-squad'], ['League season preview', 'https://example.com/news/league-preview']]
      : url.includes('/saints/')
        ? [['A point at home', 'https://example.com/news/saints-result']]
        : [['Portsmouth transfer priorities before Southampton derby', 'https://example.com/news/pompey-transfers']];
    return {
      data: `<rss version="2.0"><channel>${items.map(([title, url]) => `<item><title>${title}</title><description>Football news.</description><link>${url}</link><pubDate>Fri, 02 Oct 2026 12:00:00 GMT</pubDate></item>`).join('')}</channel></rss>`
    };
  });
}

test('general news excludes all team-assigned feeds, even those marked generic in the database', async context => {
  const fetchMock = mockNewsSources(context);
  const articles = await aggregateFeeds({ useCache: false });

  assert.equal(articles.length, 2);
  assert.ok(articles.every(article => article.source === 'BBC Sport Football'));
  assert.equal(fetchMock.mock.callCount(), 1);
});

test('team news includes assigned content and relevant generic stories, never another team source', async context => {
  const fetchMock = mockNewsSources(context);
  const articles = await aggregateFeeds({ teamId: 'Southampton', teamSlug: 'southampton', useCache: false });

  assert.deepEqual(articles.map(article => article.title), ['Southampton squad update', 'A point at home']);
  assert.equal(fetchMock.mock.callCount(), 2);
  assert.ok(fetchMock.mock.calls.every(call => !call.arguments[0].includes('/pompey/')));
});

test('slug-only team searches still filter generic articles for relevance', async context => {
  mockNewsSources(context);
  const articles = await aggregateFeeds({ teamSlug: 'southampton', useCache: false });

  assert.deepEqual(articles.map(article => article.title), ['Southampton squad update', 'A point at home']);
});

test('teams without assigned sources receive only relevant generic news', async context => {
  mockNewsSources(context);
  const articles = await aggregateFeeds({ teamSlug: 'arsenal', useCache: false });

  assert.deepEqual(articles, []);
});

test('explicit team scope is respected for legacy feeds without subscription records', async context => {
  const feeds = sourceFeeds.map(feed => feed.id === 'pompey' ? { ...feed, scope: 'team', teams: ['portsmouth'] } : feed);
  mockNewsSources(context, feeds, []);
  const articles = await aggregateFeeds({ useCache: false });

  assert.ok(articles.every(article => article.source !== 'Portsmouth News'));
});

test('shared assigned feeds remain available to each assigned team, but not general news', async context => {
  const teams = sourceTeams.map(team => ({ ...team, rssFeeds: [{ feedId: 'saints-source' }] }));
  mockNewsSources(context, [sourceFeeds[1]], teams);
  const articles = await aggregateFeeds({ teamSlug: 'portsmouth', useCache: false });
  const generalArticles = await aggregateFeeds({ useCache: false });

  assert.equal(articles.length, 1);
  assert.equal(articles[0].source, 'Saints News');
  assert.deepEqual(generalArticles, []);
});

test('assignment lookup errors fail closed rather than mixing all sources', async context => {
  const fetchMock = mockNewsSources(context);
  context.mock.method(Team, 'find', () => ({ select: () => ({ lean: async () => { throw new Error('Assignment lookup unavailable'); } }) }));

  await assert.rejects(aggregateFeeds({ useCache: false }), /Assignment lookup unavailable/);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test('successful admin feed and assignment changes invalidate cached news', async context => {
  const aggregator = require('./utils/rssAggregator');
  const clearMock = context.mock.method(aggregator, 'clearCache', () => {});
  const rssRouter = require('./routes/adminRssRoutes');
  const teamRouter = require('./routes/adminTeamFeedRoutes');
  const storedFeed = new RssFeed({ name: 'Test feed', url: 'https://example.com/rss' });
  context.mock.method(RssFeed.prototype, 'save', async function() { return this; });
  context.mock.method(RssFeed, 'findById', async () => storedFeed);
  context.mock.method(RssFeed, 'findByIdAndUpdate', async () => storedFeed);
  context.mock.method(RssFeed, 'findByIdAndDelete', async () => storedFeed);
  context.mock.method(Team, 'findByIdAndUpdate', () => ({ populate: async () => ({ _id: 'team-id', name: 'Team', rssFeeds: [] }) }));
  const actions = [
    [rssRouter, 'post', '/feeds', { body: { name: 'New feed', url: 'https://example.com/new-rss' } }],
    [rssRouter, 'put', '/feeds/:feedId', { params: { feedId: String(storedFeed._id) }, body: { enabled: false } }],
    [rssRouter, 'delete', '/feeds/:feedId', { params: { feedId: String(storedFeed._id) } }],
    [teamRouter, 'post', '/subscriptions/:teamId/feeds', { params: { teamId: 'team-id' }, body: { feedId: String(storedFeed._id) } }],
    [teamRouter, 'delete', '/subscriptions/:teamId/feeds/:feedId', { params: { teamId: 'team-id', feedId: String(storedFeed._id) } }]
  ];
  for (const [router, method, path, request] of actions) {
    const route = router.stack.find(layer => layer.route?.path === path && layer.route.methods[method]).route;
    const previousCount = clearMock.mock.callCount();
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
    await route.stack[route.stack.length - 1].handle(request, response);
    assert.ok(response.statusCode < 400, `${method} ${path} should succeed`);
    assert.equal(clearMock.mock.callCount(), previousCount + 1, `${method} ${path} should invalidate news`);
  }
});