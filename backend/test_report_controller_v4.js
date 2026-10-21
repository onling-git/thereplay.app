const assert = require('node:assert/strict');
const { test, afterEach, mock } = require('node:test');
process.env.OPENAI_API_KEY = 'test-only';
const Match = require('./models/Match');
const Report = require('./models/Report');
const ReportGenerationLock = require('./models/ReportGenerationLock');
const Team = require('./models/Team');
const ReportGenerationTrace = require('./models/ReportGenerationTrace');
const { WRITER_VERSION } = require('./services/matchReportWriterV4');

afterEach(() => mock.restoreAll());

function loadController({ match, storedReports, pipeline }) {
  mock.method(require('./models/League'), 'findOne', () => ({ select() { return this; }, lean: async () => null }));
  mock.method(require('./services/coveragePolicy'), 'assertReportTeam', async (_match, team) => {
    if (team.country_id !== 462) throw Object.assign(new Error('Outside selected coverage'), { code: 'REPORT_TEAM_NOT_ELIGIBLE' });
    return team;
  });
  mock.method(Team, 'findOne', () => ({ lean: async () => ({ country_id: 462 }) }));
  mock.method(ReportGenerationTrace, 'findOne', () => ({ lean: async () => null }));
  const locks = new Map();
  mock.method(ReportGenerationLock, 'findOneAndUpdate', async (filter, update) => {
    if (locks.has(filter._id)) throw Object.assign(new Error('duplicate lock'), { code: 11000 });
    locks.set(filter._id, update.$set.owner);
    return update.$set;
  });
  mock.method(ReportGenerationLock, 'exists', async filter => locks.get(filter._id) === filter.owner);
  mock.method(ReportGenerationLock, 'deleteOne', async filter => {
    if (locks.get(filter._id) === filter.owner) locks.delete(filter._id);
  });
  const pipelinePath = require.resolve('./services/reportPipelineV4');
  const savePath = require.resolve('./controllers/reportControllerV2');
  const controllerPath = require.resolve('./controllers/reportControllerV4');
  const previousPipeline = require.cache[pipelinePath];
  const previousSave = require.cache[savePath];
  const previousController = require.cache[controllerPath];
  const savedReports = [];

  require.cache[pipelinePath] = {
    id: pipelinePath,
    filename: pipelinePath,
    loaded: true,
    exports: { generateReportPipelineV4: pipeline }
  };
  require.cache[savePath] = {
    id: savePath,
    filename: savePath,
    loaded: true,
    exports: {
      saveReportToDatabase: async ({ report }) => {
        const saved = { ...report, _id: `saved-${savedReports.length + 1}` };
        storedReports.set(report.team_slug, saved);
        savedReports.push(saved);
        return saved;
      }
    }
  };
  delete require.cache[controllerPath];

  mock.method(Match, 'findOne', () => ({ lean: async () => match }));
  mock.method(Report, 'findOne', filter => ({
    lean: async () => storedReports.get(filter.team_slug) || null
  }));

  return {
    controller: require(controllerPath),
    savedReports,
    restore() {
      if (previousPipeline) require.cache[pipelinePath] = previousPipeline;
      else delete require.cache[pipelinePath];
      if (previousSave) require.cache[savePath] = previousSave;
      else delete require.cache[savePath];
      if (previousController) require.cache[controllerPath] = previousController;
      else delete require.cache[controllerPath];
    }
  };
}

const match = {
  match_id: 19729063,
  date: new Date(Date.now() - 2 * 60 * 60 * 1000),
  score: { home: 1, away: 1 },
  match_status: { state: 'FT' },
  home_team_slug: 'southampton',
  away_team_slug: 'portsmouth'
};

function currentReport(teamSlug) {
  return {
    match_id: match.match_id,
    team_slug: teamSlug,
    meta: {
      pipeline_version: '4.0',
      writer_provider: 'claude',
      writer_prompt_version: WRITER_VERSION
    }
  };
}

test('V4 replaces existing legacy reports and explicitly selects Claude', async () => {
  const storedReports = new Map([
    ['southampton', { team_slug: 'southampton', meta: { generated_by: 'gpt-4o-mini' } }],
    ['portsmouth', { team_slug: 'portsmouth', meta: { generated_by: 'gpt-4o-mini' } }]
  ]);
  const calls = [];
  const loaded = loadController({
    match,
    storedReports,
    pipeline: async args => {
      calls.push(args);
      return {
        report: {
          team_slug: args.teamSlug,
          meta: {
            pipeline_version: '4.0',
            writer_provider: 'claude',
            writer_prompt_version: WRITER_VERSION
          }
        },
        metadata: {}
      };
    }
  });

  try {
    const result = await loaded.controller.generateBothReportsV4ForMatch(match.match_id);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(call => call.options.writerProvider), ['claude', 'claude']);
    assert.equal(loaded.savedReports.length, 2);
    assert.equal(result.reports.home.meta.writer_provider, 'claude');
    assert.equal(result.reports.away.meta.writer_provider, 'claude');
    assert.equal(result.pipeline_version, '4.0');
  } finally {
    loaded.restore();
  }
});

test('staging blocks automatic and explicit generation before database claims or paid work', async () => {
    const previous = process.env.NODE_ENV;
    const loaded = loadController({ match, storedReports: new Map(), pipeline: async () => assert.fail('Paid work must not run') });
    process.env.NODE_ENV = 'staging';
    try {
      const result = await loaded.controller.generateBothReportsV4ForMatch(match.match_id);
      assert.equal(result.skipped, true);
      await assert.rejects(loaded.controller.generateReportV4ForTeam(match.match_id, 'southampton', { force: true }), { code: 'REPORT_GENERATION_DISABLED' });
      assert.equal(ReportGenerationLock.findOneAndUpdate.mock.callCount(), 0);
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
      loaded.restore();
    }
  });

  test('an English club gets a report against foreign opposition, but the foreign club does not', async () => {
    const calls = [];
    const loaded = loadController({
      match, storedReports: new Map(),
      pipeline: async args => {
        calls.push(args.teamSlug);
        return { report: currentReport(args.teamSlug), metadata: {} };
      }
    });
    mock.method(Team, 'findOne', filter => ({ lean: async () => ({ country_id: filter.slug === 'southampton' ? 462 : 32 }) }));
    try {
      const result = await loaded.controller.generateBothReportsV4ForMatch(match.match_id);
      assert.deepEqual(calls, ['southampton']);
      assert.equal(result.reports.away, null);
      await assert.rejects(loaded.controller.generateReportV4ForTeam(match.match_id, 'portsmouth', { force: true }), { code: 'REPORT_TEAM_NOT_ELIGIBLE' });
    } finally { loaded.restore(); }
  });

  test('unconfirmed matches skip before generation or trace creation', async () => {
    const loaded = loadController({
      match: { ...match, score: { home: null, away: null } },
      storedReports: new Map(), pipeline: async () => assert.fail('Paid work must not run')
    });
    try {
      assert.equal((await loaded.controller.generateBothReportsV4ForMatch(match.match_id)).skipped, true);
      assert.equal(ReportGenerationLock.findOneAndUpdate.mock.callCount(), 0);
    } finally { loaded.restore(); }
  });

  test('automatic paid failures cool down, while explicit regeneration remains available', async () => {
    const calls = [];
    const loaded = loadController({
      match, storedReports: new Map(),
      pipeline: async args => {
        calls.push(args.teamSlug);
        return { report: currentReport(args.teamSlug), metadata: {} };
      }
    });
    mock.method(ReportGenerationTrace, 'findOne', filter => {
      assert.equal(filter.status, 'failed');
      assert.deepEqual(filter['run2.requests.0'], { $exists: true });
      return { lean: async () => ({ status: 'failed' }) };
    });
    try {
      assert.equal(await loaded.controller.generateReportV4ForTeam(match.match_id, 'southampton'), null);
      assert.equal(calls.length, 0);
      await loaded.controller.generateReportV4ForTeam(match.match_id, 'southampton', { force: true });
      assert.equal(calls.length, 1);
    } finally { loaded.restore(); }
  });

test('V4 keeps reports only when pipeline, provider, and writer prompt are current', async () => {
  const storedReports = new Map([
    ['southampton', currentReport('southampton')],
    ['portsmouth', currentReport('portsmouth')]
  ]);
  const loaded = loadController({
    match,
    storedReports,
    pipeline: async () => assert.fail('Current V4 Claude reports should not be regenerated')
  });

  try {
    const result = await loaded.controller.generateBothReportsV4ForMatch(match.match_id);
    assert.equal(result.reports.home, storedReports.get('southampton'));
    assert.equal(result.reports.away, storedReports.get('portsmouth'));
  } finally {
    loaded.restore();
  }
});

test('automatic generation preserves paid V4 reports after a prompt version change', async () => {
  const storedReports = new Map(['southampton', 'portsmouth'].map(slug => [
    slug, { ...currentReport(slug), meta: { ...currentReport(slug).meta, writer_prompt_version: 'older-v4-prompt' } }
  ]));
  const loaded = loadController({ match, storedReports, pipeline: async () => assert.fail('Prompt edits must not trigger paid rewrites') });
  try {
    await loaded.controller.generateBothReportsV4ForMatch(match.match_id);
    assert.equal(loaded.savedReports.length, 0);
  } finally { loaded.restore(); }
});

test('concurrent automatic triggers generate each team only once and keep the trigger', async () => {
  let begin;
  let finish;
  const started = new Promise(resolve => { begin = resolve; });
  const gate = new Promise(resolve => { finish = resolve; });
  const calls = [];
  const loaded = loadController({
    match,
    storedReports: new Map(),
    pipeline: async args => {
      calls.push(args);
      if (calls.length === 2) begin();
      await gate;
      return { report: currentReport(args.teamSlug), metadata: {} };
    }
  });
  try {
    const first = loaded.controller.generateBothReportsV4ForMatch(match.match_id, { trigger: 'cron-finished' });
    await started;
    await assert.rejects(loaded.controller.generateBothReportsV4ForMatch(match.match_id), { status: 409 });
    finish();
    await first;
    await loaded.controller.generateBothReportsV4ForMatch(match.match_id);
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.options.trigger === 'cron-finished'));
    assert.equal(loaded.savedReports.length, 2);
  } finally { finish(); loaded.restore(); }
});

test('single-team automatic calls reuse saved reports but explicit regeneration remains possible', async () => {
  const storedReports = new Map([['southampton', currentReport('southampton')]]);
  const calls = [];
  const loaded = loadController({
    match, storedReports, pipeline: async args => {
      calls.push(args);
      return { report: currentReport(args.teamSlug), metadata: {} };
    }
  });
  try {
    await loaded.controller.generateReportV4ForTeam(match.match_id, 'southampton');
    assert.equal(calls.length, 0);
    await loaded.controller.generateReportV4ForTeam(match.match_id, 'southampton', { force: true, trigger: 'manual' });
    assert.equal(calls.length, 1);
    assert.equal(loaded.savedReports.length, 1);
  } finally { loaded.restore(); }
});

test('manual generation preserves the debug response and records its trigger', async () => {
  const calls = [];
  const loaded = loadController({
    match, storedReports: new Map(), pipeline: async args => {
      calls.push(args);
      return { report: currentReport(args.teamSlug), metadata: {}, interpretation: { checked: true }, dossier: { checked: true } };
    }
  });
  try {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await loaded.controller.generateReportV4({ params: { matchId: match.match_id, teamSlug: 'southampton' }, query: { debug: 'true' }, body: {} }, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.debug, { interpretation: { checked: true }, dossier: { checked: true } });
    assert.equal(calls[0].options.trigger, 'manual');
    assert.equal(calls[0].options.force, true);
  } finally { loaded.restore(); }
});

test('staging and published generation share the same paid-work claim', async () => {
  let begin;
  let finish;
  const started = new Promise(resolve => { begin = resolve; });
  const gate = new Promise(resolve => { finish = resolve; });
  const loaded = loadController({
    match, storedReports: new Map(), pipeline: async args => {
      begin();
      await gate;
      return { report: currentReport(args.teamSlug), metadata: {} };
    }
  });
  mock.method(console, 'error', () => {});
  const first = loaded.controller.generateReportV4ForTeam(match.match_id, 'southampton');
  try {
    await started;
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
    await loaded.controller.generateStagingReportV4({ params: { matchId: match.match_id, teamSlug: 'southampton' }, query: {}, body: {} }, response);
    assert.equal(response.statusCode, 409);
    finish();
    await first;
    assert.equal(loaded.savedReports.length, 1);
  } finally { finish(); await first; loaded.restore(); }
});
