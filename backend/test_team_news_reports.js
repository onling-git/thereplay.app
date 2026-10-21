const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const Report = require('./models/Report');
const Team = require('./models/Team');
const NewsCollectionSnapshot = require('./models/NewsCollectionSnapshot');
const rss = require('./utils/rssAggregator');
const policy = require('./services/coveragePolicy');
const originalAggregateFeeds = rss.aggregateFeeds;
let rssArticles;
let rssError;
rss.aggregateFeeds = async () => {
  if (rssError) throw rssError;
  return rssArticles;
};
const { getNewsForTeam, getNews } = require('./controllers/newsController');
rss.aggregateFeeds = originalAggregateFeeds;

let reports;
let pipeline;
let databaseError;
beforeEach(t => {
  t.mock.method(policy, 'getCoverage', async () => ({
    teamIds: [65, 2], competitionIds: [9], reportCompetitionIds: [9],
    teams: [{ id: 65, slug: 'southampton', name: 'Southampton' }, { id: 2, slug: 'portsmouth', name: 'Portsmouth' }]
  }));
  t.mock.method(policy, 'publicMatchFilter', async () => ({ 'match.match_info.league.id': { $in: [9] } }));
  t.mock.method(policy, 'assertPublicTeam', async slug => ({
    id: slug === 'southampton' ? 65 : 2, slug, name: slug === 'southampton' ? 'Southampton' : 'Portsmouth'
  }));
  rssArticles = [];
  rssError = null;
  databaseError = null;
  reports = [];
  pipeline = null;
});

async function request(t, slug = 'southampton', limit) {
  t.mock.method(NewsCollectionSnapshot, 'updateOne', async () => ({}));
  t.mock.method(Report, 'aggregate', async stages => {
    pipeline = stages;
    if (databaseError) throw databaseError;
    return reports;
  });
  t.mock.method(Team, 'findOne', () => ({
    lean: async () => ({ slug, name: slug === 'southampton' ? 'Southampton' : 'Portsmouth' })
  }));
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await getNewsForTeam({ params: { teamId: slug }, query: { limit } }, response);
  return response;
}

function report(overrides = {}) {
  return {
    _id: 'saints-report', match_id: 19729063, team_id: 65, team_slug: 'southampton',
    status: 'draft', generated: { headline: 'Saints win', summary_paragraphs: ['A narrow victory.'] },
    images: ['https://thereplay.app/report.jpg'], competition: { name: 'Championship' },
    createdAt: new Date('2026-10-11T15:00:00Z'),
    updatedAt: new Date('2026-10-14T15:00:00Z'),
    ...overrides
  };
}

test('maps public reports without changing publication dates or provider data', async t => {
  const saved = report();
  reports = [saved];
  const before = structuredClone(saved);
  const res = await request(t);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, [{
    id: 'report-saints-report', kind: 'match-report', title: 'Saints win',
    summary: 'A narrow victory.', source: 'The Replay', published_at: saved.createdAt,
    league_id: null, league_name: 'Championship', team_id: 65,
    image_url: 'https://thereplay.app/report.jpg',
    url: 'https://thereplay.app/southampton/match/19729063/report'
  }]);
  assert.deepEqual(saved, before);
});

test('query restricts team perspective and requires a linked public report with a headline', async t => {
  await request(t, 'portsmouth', 3);
  assert.deepEqual(pipeline[0].$match.team_slug, { $in: ['southampton', 'portsmouth'] });
  assert.deepEqual(pipeline[0].$match.$and, [{ team_slug: 'portsmouth' }]);
  assert.deepEqual(pipeline[0].$match.$or, [
    { 'generated.headline': { $regex: '\\S' } }, { headline: { $regex: '\\S' } }
  ]);
  assert.deepEqual(pipeline[1].$lookup, {
    from: 'matches', localField: 'match_id', foreignField: 'match_id', as: 'match'
  });
  assert.deepEqual(pipeline.find(stage => stage.$match?.$expr).$match.$expr.$or, [
    { $eq: ['$_id', '$match.reports.home'] },
    { $eq: ['$_id', '$match.reports.away'] }
  ]);
  assert.equal(pipeline[0].$match.status, undefined);
  assert.deepEqual(pipeline.find(stage => stage.$sort), { $sort: { createdAt: -1, _id: 1 } });
  assert.deepEqual(pipeline.find(stage => stage.$limit), { $limit: 3 });
});

test('merges RSS and reports before applying the total limit', async t => {
  reports = [report()];
  rssArticles = [
    { id: 'old', title: 'Old', url: 'https://example.com/old', published_at: '2026-10-10T15:00:00Z' },
    { id: 'new', title: 'New', url: 'https://example.com/new', published_at: '2026-10-12T15:00:00Z' }
  ];
  const res = await request(t, 'southampton', 2);
  assert.deepEqual(res.body.map(item => item.id), ['new', 'report-saints-report']);
  assert.equal(res.body[0].source, undefined);
  assert.equal(res.body[0].kind, undefined);
});

test('equal timestamps have deterministic URL/ID ordering and duplicate URLs appear once', async t => {
  reports = [report()];
  const date = reports[0].createdAt.toISOString();
  rssArticles = [
    { id: 'duplicate', url: 'https://thereplay.app/southampton/match/19729063/report', published_at: date },
    { id: 'z', url: 'https://example.com/z', published_at: date },
    { id: 'a', url: 'https://example.com/a', published_at: date }
  ];
  const first = (await request(t)).body;
  rssArticles.reverse();
  const second = (await request(t)).body;
  assert.deepEqual(second, first);
  assert.deepEqual(first.map(item => item.id), ['a', 'z', 'report-saints-report']);
});

test('reports remain available when RSS fails, with the failure logged', async t => {
  reports = [report()];
  rssError = new Error('Feed unavailable');
  const logger = t.mock.method(console, 'error', () => {});
  const res = await request(t);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body[0].kind, 'match-report');
  assert.ok(logger.mock.calls.some(call => call.arguments.includes('Feed unavailable')));
});

test('report database failure returns an explicit error rather than a partial successful feed', async t => {
  databaseError = new Error('Database unavailable');
  const logger = t.mock.method(console, 'error', () => {});
  const res = await request(t);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { error: 'Failed to get team news' });
  assert.ok(logger.mock.calls.length);
});

test('supports legacy top-level headlines and summaries and the away perspective URL', async t => {
  reports = [report({
    _id: 'pompey-report', team_slug: 'portsmouth', team_id: 2,
    generated: {}, headline: 'Pompey fall short', summary_paragraphs: ['No breakthrough.'],
    images: [], competition: undefined
  })];
  const res = await request(t, 'portsmouth');
  assert.equal(res.body[0].url, 'https://thereplay.app/portsmouth/match/19729063/report');
  assert.equal(res.body[0].title, 'Pompey fall short');
  assert.equal(res.body[0].summary, 'No breakthrough.');
  assert.equal(res.body[0].image_url, null);
});

test('empty sources produce an empty list and limits are bounded', async t => {
  assert.deepEqual((await request(t, 'southampton', -1)).body, []);
  assert.equal(pipeline.find(stage => stage.$limit).$limit, 1);
  await request(t, 'southampton', 100);
  assert.equal(pipeline.find(stage => stage.$limit).$limit, 50);
});

test('general news persists genuine newest publication date while preserving its RSS response', async t => {
  const writes = t.mock.method(NewsCollectionSnapshot, 'updateOne', async () => ({}));
  rssArticles = [{
    id: 'rss-story', title: 'Football news', url: 'https://example.com/story',
    published_at: '2026-09-01T10:00:00Z', source_published_at: '2026-09-01T10:00:00Z'
  }];
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await getNews({ query: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body[0].id, 'rss-story');
  assert.equal(res.body[0].kind, undefined);
  assert.deepEqual(writes.mock.calls[0].arguments[0], { path: '/news' });
  assert.equal(writes.mock.calls[0].arguments[1].$set.newest_published_at.toISOString(), '2026-09-01T10:00:00.000Z');
});

test('snapshot persistence failure is explicitly logged and returned as an error', async t => {
  const logger = t.mock.method(console, 'error', () => {});
  t.mock.method(NewsCollectionSnapshot, 'updateOne', async () => { throw new Error('Snapshot unavailable'); });
  rssArticles = [{ url: 'https://example.com/story', source_published_at: '2026-09-01T10:00:00Z' }];
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  await getNews({ query: {} }, res);
  assert.equal(res.statusCode, 500);
  assert.ok(logger.mock.calls.length);
});
