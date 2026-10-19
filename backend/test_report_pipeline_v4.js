const assert = require('node:assert/strict');
const { test, afterEach, mock } = require('node:test');
process.env.OPENAI_API_KEY = 'test-only';
const Trace = require('./models/ReportGenerationTrace');
const pipeline = require('./services/reportPipeline');
const interpretation = require('./services/matchInterpretation');
const writer = require('./services/matchReportWriterV4');
const dossierBuilder = require('./services/reportEvidenceDossierV4');

afterEach(() => mock.restoreAll());

function loadPipeline({ tweets = [], usableTweets = [], prepareError, writerError } = {}) {
  const snapshots = [];
  mock.method(Trace.prototype, 'save', async function () {
    snapshots.push(this.toObject());
    return this;
  });
  mock.method(pipeline, 'prepareMatchData', async () => {
    if (prepareError) throw prepareError;
    return { match: { match_id: 123 }, team: {}, teamFocus: 'Home', teamSide: 'home', tweets, competitionContext: {} };
  });
  mock.method(pipeline, 'validateAuthoritativeMatchData', () => ({ validation_warnings: [] }));
  mock.method(pipeline, 'determinePOTM', () => ({}));
  mock.method(pipeline, 'enrichReport', ({ report }) => ({ ...report, embedded_tweets: [] }));
  mock.method(interpretation, 'interpretMatch', async ({ trace }) => {
    trace.model = 'gpt-4o-mini';
    trace.requests.push({ kind: 'initial', usage: { prompt_tokens: 10, completion_tokens: 5 } });
    return {};
  });
  mock.method(dossierBuilder, 'buildEditorialDossierV4', () => ({ supported_observations: { reporter_facts: usableTweets } }));
  mock.method(writer, 'writeMatchReportV4', async ({ trace }) => {
    trace.requests.push({ kind: 'initial', usage: { input_tokens: 100, output_tokens: 25, cache_read_input_tokens: 200 } });
    if (writerError) throw writerError;
    return { meta: { writer_provider: 'claude' } };
  });
  const path = require.resolve('./services/reportPipelineV4');
  const previous = require.cache[path];
  delete require.cache[path];
  return {
    generate: require(path).generateReportPipelineV4,
    snapshots,
    restore() {
      if (previous) require.cache[path] = previous;
      else delete require.cache[path];
    }
  };
}

test('a report with no usable tweets is flagged, not delayed or regenerated', async () => {
  const loaded = loadPipeline({ tweets: [{ tweet_id: 'irrelevant' }] });
  try {
    const result = await loaded.generate({ matchId: 123, teamSlug: 'home', options: { trigger: 'cron-finished' } });
    assert.deepEqual(result.report.meta.social_evidence, {
      available_tweets: 1, usable_tweets: 0, embedded_tweets: 0, generated_without_usable_tweets: true
    });
    assert.equal(result.report.meta.generation_trigger, 'cron-finished');
    const saved = loaded.snapshots.at(-1);
    assert.equal(saved.status, 'completed');
    assert.equal(saved.run1.requests[0].usage.prompt_tokens, 10);
    assert.equal(saved.run2.requests[0].usage.cache_read_input_tokens, 200);
    assert.equal(saved.trigger, 'cron-finished');
    assert.equal(writer.writeMatchReportV4.mock.callCount(), 1);
  } finally { loaded.restore(); }
});

test('usable evidence is distinct from whether the writer embeds a tweet', async () => {
  const loaded = loadPipeline({ tweets: [{}], usableTweets: [{ source_id: 'reporter' }] });
  try {
    const result = await loaded.generate({ matchId: 123, teamSlug: 'home', options: { force: true, trigger: 'manual' } });
    assert.equal(result.report.meta.social_evidence.generated_without_usable_tweets, false);
    assert.equal(result.report.meta.social_evidence.embedded_tweets, 0);
    assert.equal(loaded.snapshots.at(-1).forced, true);
  } finally { loaded.restore(); }
});

test('writer failures retain both runs usage and mark the trace failed', async () => {
  const loaded = loadPipeline({ writerError: new Error('invalid writer JSON') });
  try {
    await assert.rejects(loaded.generate({ matchId: 123, teamSlug: 'home' }), /invalid writer JSON/);
    const saved = loaded.snapshots.at(-1);
    assert.equal(saved.status, 'failed');
    assert.equal(saved.run1.requests.length, 1);
    assert.equal(saved.run2.requests.length, 1);
    assert.equal(saved.run2.error, 'invalid writer JSON');
  } finally { loaded.restore(); }
});

test('preparation failures are traced before either paid run starts', async () => {
  const loaded = loadPipeline({ prepareError: new Error('match unavailable') });
  try {
    await assert.rejects(loaded.generate({ matchId: 123, teamSlug: 'home' }), /match unavailable/);
    const saved = loaded.snapshots.at(-1);
    assert.equal(saved.status, 'failed');
    assert.equal(saved.run1.requests.length, 0);
    assert.equal(saved.run2.requests.length, 0);
  } finally { loaded.restore(); }
});

test('loss of generation ownership stops before starting paid AI work', async () => {
  const loaded = loadPipeline();
  try {
    await assert.rejects(loaded.generate({
      matchId: 123, teamSlug: 'home',
      options: { assertOwnership: async () => { throw new Error('lease lost'); } }
    }), /lease lost/);
    assert.equal(interpretation.interpretMatch.mock.callCount(), 0);
    assert.equal(writer.writeMatchReportV4.mock.callCount(), 0);
  } finally { loaded.restore(); }
});

test('Report schema persists the social flag and generation trigger', () => {
  const Report = require('./models/Report');
  const report = new Report({ meta: { generation_trigger: 'manual', social_evidence: { available_tweets: 0, usable_tweets: 0, embedded_tweets: 0, generated_without_usable_tweets: true } } });
  assert.equal(report.toObject().meta.social_evidence.generated_without_usable_tweets, true);
  assert.equal(report.toObject().meta.generation_trigger, 'manual');
});

test('immediate collection searches through now, once per focused team, without rewriting reports', async () => {
  const readiness = require('./services/reportMatchReadiness');
  const history = require('./services/reportHistoricalContext');
  const statistics = require('./services/reportStatisticalContext');
  const league = require('./services/reportLeagueContext');
  const Team = require('./models/Team');
  const Tweet = require('./models/Tweet');
  const twitter = require('./utils/twitterService');
  const Report = require('./models/Report');
  const kickoff = new Date(Date.now() - 110 * 60 * 1000);
  const match = {
    match_id: 123, date: kickoff, match_info: { starting_at: kickoff, league: { name: 'Premier League' } },
    home_team: 'Home', away_team: 'Away', home_team_slug: 'home', away_team_slug: 'away',
    teams: { home: { team_id: 1 }, away: { team_id: 2 } }, score: { home: 0, away: 0 }
  };
  const originalKey = process.env.TWITTERAPI_KEY;
  process.env.TWITTERAPI_KEY = 'test-only';
  mock.method(readiness, 'loadReportMatch', async () => match);
  mock.method(history, 'loadHistoricalContext', async () => null);
  mock.method(statistics, 'loadXgContext', async () => ({ available: false, reason: 'unavailable' }));
  mock.method(league, 'loadLeagueContext', async () => ({ available: false }));
  mock.method(Team, 'findOne', filter => ({
    lean: async () => {
      const id = filter.id || (filter.slug === 'home' ? 1 : 2);
      return { id, name: id === 1 ? 'Home' : 'Away', slug: id === 1 ? 'home' : 'away', twitter: { reporters: [{ handle: `reporter${id}` }] } };
    }
  }));
  const count = mock.method(Tweet, 'countDocuments', async () => 0);
  mock.method(Tweet, 'find', () => ({ sort() { return this; }, limit() { return this; }, lean: async () => [] }));
  const search = mock.method(twitter, 'searchByUser', async () => ({ tweets: [] }));
  mock.method(Report, 'updateOne', async () => assert.fail('Tweet gathering must not modify saved reports'));
  const path = require.resolve('./services/reportPipeline');
  const previous = require.cache[path];
  delete require.cache[path];
  try {
    const { prepareMatchData } = require(path);
    const before = Date.now();
    await Promise.all([prepareMatchData(123, 'home'), prepareMatchData(123, 'away')]);
    assert.equal(search.mock.callCount(), 2);
    assert.deepEqual(count.mock.calls.map(call => call.arguments[0].team_id.$in).sort(), [[1], [2]]);
    assert.deepEqual(search.mock.calls.map(call => call.arguments[0][0]).sort(), ['reporter1', 'reporter2']);
    for (const call of search.mock.calls) {
      const options = call.arguments[1];
      assert.equal(options.since.getTime(), kickoff.getTime());
      assert.ok(options.until.getTime() >= before);
      assert.ok(options.until.getTime() - kickoff.getTime() > 100 * 60 * 1000);
    }
  } finally {
    require.cache[path] = previous;
    if (originalKey === undefined) delete process.env.TWITTERAPI_KEY;
    else process.env.TWITTERAPI_KEY = originalKey;
  }
});
