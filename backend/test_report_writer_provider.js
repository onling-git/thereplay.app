const assert = require('node:assert/strict');
const { test, afterEach, mock } = require('node:test');
process.env.OPENAI_API_KEY = 'test-only';
const axios = require('axios');
const { client } = require('./utils/openai');
const { getReportWriterConfig, completeReport } = require('./services/reportWriterProvider');
const { writeMatchReport } = require('./services/matchReportWriter');
const { writeMatchReportV36 } = require('./services/matchReportWriterV36');
const { writeMatchReportV4 } = require('./services/matchReportWriterV4');

const originalEnv = { ...process.env };
afterEach(() => {
  mock.restoreAll();
  process.env = { ...originalEnv };
});

const report = { headline: 'A 0-0 draw', summary_paragraphs: ['The match ended 0-0.'], player_of_the_match: { player: 'Player', reason: 'Rating' } };
const facts = { final_score: { home: 0, away: 0 }, scoring_events: [] };
const dossier = { focused_club: { name: 'Home' }, authoritative_facts: facts, prohibited_or_unsupported_claims: [], supported_observations: { reporter_facts: [], potm: {} } };

test('defaults, explicit models, invalid provider and missing Claude key', () => {
  delete process.env.REPORT_MODEL;
  assert.deepEqual(getReportWriterConfig(), { provider: 'openai', model: 'gpt-4o-mini' });
  assert.equal(getReportWriterConfig('openai', 'custom-openai').model, 'custom-openai');
  assert.throws(() => getReportWriterConfig('other'), { status: 400 });
  delete process.env.CLAUDE_API_KEY;
  assert.throws(() => getReportWriterConfig('claude'), { status: 503 });
  process.env.CLAUDE_API_KEY = 'test-only';
  delete process.env.CLAUDE_REPORT_MODEL;
  assert.equal(getReportWriterConfig('claude').model, 'claude-opus-5-5');
  process.env.CLAUDE_REPORT_MODEL = 'custom-claude';
  assert.equal(getReportWriterConfig('claude', 'custom-openai').model, 'custom-claude');
});

test('OpenAI request format and V4 GPT-5 token settings remain unchanged', async () => {
  const create = mock.method(client.chat.completions, 'create', async () => ({ choices: [{ message: { content: JSON.stringify(report) } }] }));
  await writeMatchReport({ interpretation: {}, match: {}, potm: report.player_of_the_match, authoritativeMatchFacts: facts });
  assert.equal(create.mock.calls[0].arguments[0].max_tokens, 2500);
  assert.equal(create.mock.calls[0].arguments[0].temperature, 0.4);
  assert.deepEqual(create.mock.calls[0].arguments[0].response_format, { type: 'json_object' });
  process.env.V4_EDITOR_WRITER_MODEL = 'gpt-5-test';
  await writeMatchReportV4({ dossier });
  const payload = create.mock.calls.at(-1).arguments[0];
  assert.equal(payload.model, 'gpt-5-test');
  assert.equal(payload.max_completion_tokens, 2200);
  assert.equal(payload.temperature, undefined);
  assert.equal(payload.max_tokens, undefined);
});

test('all active writers use Opus with reasoning headroom and identify the provider', async () => {
  process.env.CLAUDE_API_KEY = 'test-only';
  delete process.env.CLAUDE_REPORT_MODEL;
  mock.method(client.chat.completions, 'create', async () => assert.fail('Unexpected OpenAI call'));
  const post = mock.method(axios, 'post', async () => ({ data: { stop_reason: 'end_turn', content: [{ type: 'thinking', thinking: '', signature: 'test' }, { type: 'text', text: '```json\n' + JSON.stringify(report) + '\n```' }] } }));
  const run2Trace = {};
  const v2 = await writeMatchReport({ interpretation: {}, match: {}, potm: report.player_of_the_match, authoritativeMatchFacts: facts, writerProvider: 'claude', trace: run2Trace });
  const v3 = await writeMatchReportV36({ editorialPlan: { component_plan: {}, claim_ledger: {} }, authoritativeMatchFacts: facts, writerProvider: 'claude' });
  const v4 = await writeMatchReportV4({ dossier, writerProvider: 'claude' });
  for (const output of [v2, v3.report, v4]) assert.equal(output.meta.writer_provider, 'claude');
  assert.equal(run2Trace.provider, 'claude');
  for (const call of post.mock.calls) {
    const payload = call.arguments[1];
    assert.equal(payload.model, 'claude-opus-5-5');
    assert.equal(payload.max_tokens, 16000);
    assert.equal(payload.temperature, undefined);
    assert.deepEqual(payload.output_config, { effort: 'high' });
  }
  assert.equal(post.mock.calls[0].arguments[0], 'https://api.anthropic.com/v1/messages');
  assert.equal(post.mock.calls[0].arguments[2].headers['x-api-key'], 'test-only');
});

test('V2 and V4 repairs stay on Claude', async () => {
  process.env.CLAUDE_API_KEY = 'test-only';
  delete process.env.CLAUDE_REPORT_MODEL;
  mock.method(client.chat.completions, 'create', async () => assert.fail('Unexpected OpenAI repair'));
  let attempts = 0;
  const post = mock.method(axios, 'post', async () => ({ data: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(attempts++ % 2 === 0 ? { ...report, headline: 'A crucial 0-0 draw', summary_paragraphs: ['A crucial 0-0 draw.'] } : report) }] } }));
  await writeMatchReport({ interpretation: {}, match: {}, potm: report.player_of_the_match, authoritativeMatchFacts: facts, writerProvider: 'claude' });
  assert.equal(post.mock.callCount(), 2);
  await writeMatchReportV4({ dossier: { ...dossier, prohibited_or_unsupported_claims: ['crucial'] }, writerProvider: 'claude' });
  assert.equal(post.mock.callCount(), 4);
  assert.equal(post.mock.calls[1].arguments[1].model, 'claude-opus-5-5');
  assert.equal(post.mock.calls[3].arguments[1].model, 'claude-opus-5-5');
  assert.equal(post.mock.calls[1].arguments[1].temperature, undefined);
  assert.equal(post.mock.calls[3].arguments[1].temperature, undefined);
});

test('explicit Sonnet override retains its sampling and token settings', async () => {
  process.env.CLAUDE_API_KEY = 'test-only';
  process.env.CLAUDE_REPORT_MODEL = 'claude-sonnet-4-6';
  const post = mock.method(axios, 'post', async () => ({ data: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(report) }] } }));
  await completeReport({ ...getReportWriterConfig('claude'), prompt: 'prompt', systemPrompt: 'system', temperature: 0.4, maxTokens: 2500 });
  const payload = post.mock.calls[0].arguments[1];
  assert.equal(payload.model, 'claude-sonnet-4-6');
  assert.equal(payload.max_tokens, 2500);
  assert.equal(payload.temperature, 0.4);
  assert.equal(payload.output_config, undefined);
});

test('Claude truncation, refusal and API failures fail explicitly without leaking request headers', async () => {
  process.env.CLAUDE_API_KEY = 'test-only';
  const args = { ...getReportWriterConfig('claude'), prompt: 'prompt', systemPrompt: 'system', temperature: 0.4 };
  const post = mock.method(axios, 'post', async () => ({ data: { stop_reason: 'max_tokens' } }));
  await assert.rejects(completeReport(args), /did not complete: max_tokens/);
  post.mock.mockImplementation(async () => ({ data: { stop_reason: 'refusal' } }));
  await assert.rejects(completeReport(args), /did not complete: refusal/);
  post.mock.mockImplementation(async () => { throw { response: { status: 401, data: { error: { message: 'Invalid API key' } } }, config: { headers: { 'x-api-key': 'secret' } } }; });
  await assert.rejects(completeReport(args), error => error.message.includes('401') && !JSON.stringify(error).includes('secret'));
});

test('draft controllers select providers, save only drafts, and fail configuration checks before generation', async () => {
  const ReportStaging = require('./models/ReportStaging');
  const Report = require('./models/Report');
  mock.method(Report, 'findOneAndUpdate', async () => assert.fail('Draft wrote to published reports'));
  const saveDraft = mock.method(ReportStaging, 'findOneAndUpdate', async (filter, update) => ({ report: update.$set.report }));
  mock.method(console, 'error', () => {});
  for (const version of ['V2', 'V3', 'V4']) {
    const pipelinePath = require.resolve(`./services/reportPipeline${version === 'V2' ? '' : version}`);
    const controllerPath = require.resolve(`./controllers/reportController${version}`);
    const previousPipeline = require.cache[pipelinePath];
    const previousController = require.cache[controllerPath];
    const calls = [];
    require.cache[pipelinePath] = { id: pipelinePath, filename: pipelinePath, loaded: true, exports: {
      [`generateReportPipeline${version === 'V2' ? '' : version}`]: async args => {
        calls.push(args);
        return { report: { ...report, meta: { writer_provider: args.options.writerProvider } }, metadata: {} };
      }
    } };
    delete require.cache[controllerPath];
    try {
      const generate = require(controllerPath)[`generateStagingReport${version}`];
      const invoke = async body => {
        const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } };
        await generate({ params: { matchId: '123', teamSlug: 'home' }, query: {}, body }, response);
        return response;
      };
      const initialWrites = saveDraft.mock.callCount();
      assert.equal((await invoke({ writerProvider: 'invalid' })).statusCode, 400);
      delete process.env.CLAUDE_API_KEY;
      assert.equal((await invoke({ writerProvider: 'claude' })).statusCode, 503);
      assert.equal(calls.length, 0);
      assert.equal(saveDraft.mock.callCount(), initialWrites);
      assert.equal((await invoke(undefined)).statusCode, 200);
      assert.equal(calls[0].options.writerProvider, 'openai');
      process.env.CLAUDE_API_KEY = 'test-only';
      const result = await invoke({ writerProvider: 'claude' });
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.report.meta.writer_provider, 'claude');
      assert.equal(calls[1].options.writerProvider, 'claude');
      assert.equal(saveDraft.mock.callCount(), initialWrites + 2);
    } finally {
      if (previousPipeline) require.cache[pipelinePath] = previousPipeline;
      else delete require.cache[pipelinePath];
      if (previousController) require.cache[controllerPath] = previousController;
      else delete require.cache[controllerPath];
    }
  }
});