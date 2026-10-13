const assert = require('node:assert/strict');
const { test, afterEach, mock } = require('node:test');
process.env.OPENAI_API_KEY = 'test-only';
const Match = require('./models/Match');
const Report = require('./models/Report');
const { WRITER_VERSION } = require('./services/matchReportWriterV4');

afterEach(() => mock.restoreAll());

function loadController({ match, storedReports, pipeline }) {
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
