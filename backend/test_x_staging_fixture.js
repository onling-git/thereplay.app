const assert = require('node:assert/strict');
const { test, afterEach, mock } = require('node:test');
const axios = require('axios');

process.env.OPENAI_API_KEY = 'test-only';
const Match = require('./models/Match');
const Report = require('./models/Report');
const Team = require('./models/Team');
const Tweet = require('./models/Tweet');
const Checkpoint = require('./models/ReporterCollectionCheckpoint');
const coverage = require('./services/coveragePolicy');
const { collectTweetsForLiveMatches } = require('./services/liveTweetCollector');
const { saveReportToDatabase } = require('./controllers/reportControllerV2');

const envKeys = [
  'NODE_ENV', 'RAILWAY_ENVIRONMENT_NAME', 'REPORTER_TWEET_PROVIDER',
  'X_API_BEARER_TOKEN', 'X_REPORTER_FALLBACK_ENABLED', 'TWITTERAPI_KEY',
  'X_REPORT_PUBLISH_MODE', 'X_REPORT_SITE_URL'
];
const originalEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));

afterEach(() => {
  mock.restoreAll();
  for (const key of envKeys) {
    if (originalEnv[key] === undefined) delete process.env[key];
    else process.env[key] = originalEnv[key];
  }
});

test('staging fixture collects an official reporter post without a hashtag and saves its checkpoint', async () => {
  process.env.NODE_ENV = 'staging';
  process.env.REPORTER_TWEET_PROVIDER = 'x';
  process.env.X_API_BEARER_TOKEN = 'fixture-token';
  process.env.X_REPORTER_FALLBACK_ENABLED = 'false';
  const kickoff = new Date(Date.now() - 60 * 60 * 1000);
  const createdAt = new Date(kickoff.getTime() + 10 * 60 * 1000).toISOString();
  const team = { id: 1, slug: 'fixture-team', name: 'Fixture Team', twitter: {
    hashtag: '#FIXTURE', reporters: [{ handle: '@fixtureReporter' }]
  } };
  mock.method(coverage, 'getCoverage', async () => ({ teamIds: [1] }));
  mock.method(Team, 'findOne', () => ({ lean: async () => team }));
  mock.method(Checkpoint, 'findById', () => ({ lean: async () => null }));
  const checkpoint = mock.method(Checkpoint, 'updateOne', async () => ({ acknowledged: true }));
  mock.method(Tweet, 'findOne', async () => null);
  const saved = mock.method(Tweet, 'create', async tweet => tweet);
  const request = mock.method(axios, 'get', async (_url, config) => {
    assert.equal(config.params.query, '(from:fixturereporter)');
    assert.equal(new Date(config.params.start_time).getTime(), kickoff.getTime());
    return { data: {
      data: [{ id: 'fixture-post', text: 'A match update without a hashtag', author_id: '42', created_at: createdAt }],
      includes: { users: [{ id: '42', username: 'fixtureReporter', name: 'Fixture Reporter' }] },
      meta: { result_count: 1 }
    } };
  });
  mock.method(axios, 'post', async () => assert.fail('Unexpected outbound POST'));

  await collectTweetsForLiveMatches([{
    match_id: 987656, date: kickoff, teams: { home: { team_id: 1 }, away: { team_id: 2 } }
  }]);

  assert.equal(request.mock.callCount(), 1);
  assert.equal(saved.mock.callCount(), 1);
  assert.equal(saved.mock.calls[0].arguments[0].api_source, 'x-api');
  assert.equal(saved.mock.calls[0].arguments[0].tweet_id, 'fixture-post');
  assert.equal(checkpoint.mock.callCount(), 1);
});

test('staging fixture saves a report and produces a dry-run post after linking the match', async () => {
  process.env.NODE_ENV = 'staging';
  process.env.X_REPORT_PUBLISH_MODE = 'dry-run';
  process.env.X_REPORT_SITE_URL = 'https://staging.example.com';
  const match = {
    match_id: 123, home_team: 'Fixture Team', away_team: 'Visitors',
    teams: { home: { team_id: 1, team_slug: 'fixture-team' }, away: { team_id: 2, team_slug: 'visitors' } },
    score: { home: 2, away: 1 }, events: [], reports: {}
  };
  const team = { id: 1, twitter: { hashtag: '#FIXTURE' } };
  const report = {
    team_slug: 'fixture-team', team_name: 'Fixture Team', headline: 'Fixture Team win',
    summary_paragraphs: ['A fixture report.'], key_moments: [], commentary: [],
    sources: [], embedded_tweets: [], meta: {}
  };
  let stored;
  let finish;
  const completed = new Promise(resolve => { finish = resolve; });
  mock.method(Match, 'findOne', () => ({ lean: async () => match }));
  mock.method(Match, 'updateOne', async (_filter, update) => {
    match.reports.home = update.$set['reports.home'];
    return { matchedCount: 1 };
  });
  mock.method(Report, 'findOne', async () => null);
  mock.method(Report, 'create', async document => {
    stored = new Report(document);
    return stored;
  });
  mock.method(Report, 'findOneAndUpdate', filter => ({
    lean: async () => {
      assert.equal(filter['x_publication.mode'], 'dry-run');
      assert.equal(String(match.reports.home), String(stored._id));
      return stored.toObject();
    }
  }));
  mock.method(coverage, 'publicMatchFilter', async () => ({}));
  mock.method(Team, 'findOne', () => ({ lean: async () => team }));
  mock.method(Report, 'updateOne', async (_filter, update) => {
    finish(update.$set);
    return { matchedCount: 1 };
  });
  mock.method(axios, 'post', async () => assert.fail('Dry run must not contact X'));
  mock.method(axios, 'get', async () => assert.fail('Unexpected outbound GET'));

  const saved = await saveReportToDatabase({
    report, matchId: 123, teamSlug: 'fixture-team', metadata: { competition: 'Fixture', stage: 'Test' }
  });
  const publication = await Promise.race([
    completed,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Dry-run publication did not complete')), 1000))
  ]);
  assert.equal(String(saved._id), String(match.reports.home));
  assert.equal(publication['x_publication.state'], 'dry_run');
  assert.equal(publication['x_publication.text'], 'Fixture Team win\n\n#FIXTURE\nhttps://staging.example.com/fixture-team/match/123/report');
});
