const assert = require('node:assert/strict');
const { test, afterEach, mock } = require('node:test');
process.env.OPENAI_API_KEY = 'test-only';
const axios = require('axios');
const { client } = require('./utils/openai');
const { getReportWriterConfig, completeReport } = require('./services/reportWriterProvider');
const { writeMatchReport } = require('./services/matchReportWriter');
const { writeMatchReportV36 } = require('./services/matchReportWriterV36');
const { writeMatchReportV4 } = require('./services/matchReportWriterV4');
const { buildEditorialDossierV4 } = require('./services/reportEvidenceDossierV4');
const { interpretMatch } = require('./services/matchInterpretation');

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

test('OpenAI request format and explicit V4 GPT-5 override remain unchanged', async () => {
  const create = mock.method(client.chat.completions, 'create', async () => ({ choices: [{ message: { content: JSON.stringify(report) } }] }));
  await writeMatchReport({ interpretation: {}, match: {}, potm: report.player_of_the_match, authoritativeMatchFacts: facts });
  assert.equal(create.mock.calls[0].arguments[0].max_tokens, 2500);
  assert.equal(create.mock.calls[0].arguments[0].temperature, 0.4);
  assert.deepEqual(create.mock.calls[0].arguments[0].response_format, { type: 'json_object' });
  process.env.V4_EDITOR_WRITER_MODEL = 'gpt-5-test';
  const v4Report = await writeMatchReportV4({ dossier, writerProvider: 'openai' });
  assert.equal(v4Report.meta.writer_provider, 'openai');
  const payload = create.mock.calls.at(-1).arguments[0];
  assert.equal(payload.model, 'gpt-5-test');
  assert.equal(payload.max_completion_tokens, 2200);
  assert.equal(payload.temperature, undefined);
  assert.equal(payload.max_tokens, undefined);
});

test('V4 does not fall back to OpenAI when Claude generation fails', async () => {
  process.env.CLAUDE_API_KEY = 'test-only';
  const post = mock.method(axios, 'post', async () => { throw new Error('Claude unavailable'); });
  const create = mock.method(client.chat.completions, 'create', async () => ({ choices: [{ message: { content: JSON.stringify(report) } }] }));
  const trace = {};

  await assert.rejects(writeMatchReportV4({ dossier, trace }), /Claude report request failed/);

  assert.equal(post.mock.callCount(), 1);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(trace.provider, 'claude');
});

test('Report schema preserves V4 writer metadata', () => {
  const Report = require('./models/Report');
  const savedReport = new Report({
    meta: {
      generated_by: 'claude-opus-5-5',
      writer_provider: 'claude',
      pipeline_version: '4.0',
      writer_prompt_version: 'v4-rich-context-writer-2026-10-01.1'
    }
  });

  assert.equal(savedReport.meta.writer_provider, 'claude');
  assert.equal(savedReport.meta.pipeline_version, '4.0');
  assert.equal(savedReport.meta.writer_prompt_version, 'v4-rich-context-writer-2026-10-01.1');
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
    assert.equal(payload.output_config.effort, 'high');
    assert.equal(payload.output_config.format.type, 'json_schema');
    assert.equal(payload.output_config.format.schema.additionalProperties, false);
    assert.deepEqual(payload.output_config.format.schema.required, ['headline', 'summary_paragraphs']);
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
  assert.equal(payload.output_config.effort, undefined);
  assert.equal(payload.output_config.format.type, 'json_schema');
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
  const ReportGenerationLock = require('./models/ReportGenerationLock');
  mock.method(ReportGenerationLock, 'findOneAndUpdate', async () => ({}));
  mock.method(ReportGenerationLock, 'exists', async () => true);
  mock.method(ReportGenerationLock, 'deleteOne', async () => ({}));
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
      if (version !== 'V4') {
        assert.equal((await invoke({ writerProvider: 'claude' })).statusCode, 503);
        assert.equal(calls.length, 0);
        assert.equal(saveDraft.mock.callCount(), initialWrites);
      }
      const defaultCallIndex = calls.length;
      assert.equal((await invoke(undefined)).statusCode, 200);
      assert.equal(calls[defaultCallIndex].options.writerProvider, version === 'V4' ? 'claude' : 'openai');
      process.env.CLAUDE_API_KEY = 'test-only';
      const result = await invoke({ writerProvider: 'claude' });
      assert.equal(result.statusCode, 200);
      assert.equal(result.body.report.meta.writer_provider, 'claude');
      assert.equal(calls[defaultCallIndex + 1].options.writerProvider, 'claude');
      assert.equal(saveDraft.mock.callCount(), initialWrites + 2);
    } finally {
      if (previousPipeline) require.cache[pipelinePath] = previousPipeline;
      else delete require.cache[pipelinePath];
      if (previousController) require.cache[controllerPath] = previousController;
      else delete require.cache[controllerPath];
    }
  }
});

test('all writers receive the same verified historical facts', async () => {
  process.env.CLAUDE_API_KEY = 'test-only';
  const historicalContext = { facts: [{ fact_id: 'verified-streak', text: 'Test Scorer has scored in 5 consecutive Championship matches.' }] };
  const statisticalContext = { teams: [{ metrics: { shots_on_target: 7, big_chances_missed: 3 } }], source: 'verified-statistical-evidence' };
  const leagueContext = { available: true, scope: 'end_of_round', teams: [{ official_points: 10 }], source: 'verified-league-evidence' };
  const contextualFacts = { ...facts, historical_context: historicalContext, statistical_context: statisticalContext, league_context: leagueContext };
  const create = mock.method(client.chat.completions, 'create', async () => ({ choices: [{ message: { content: JSON.stringify(report) } }] }));
  await writeMatchReport({ interpretation: {}, match: {}, potm: report.player_of_the_match, authoritativeMatchFacts: contextualFacts });
  await writeMatchReportV36({ editorialPlan: { component_plan: {}, claim_ledger: {} }, authoritativeMatchFacts: contextualFacts });
  const contextualDossier = buildEditorialDossierV4({ interpretation: {}, authoritativeMatchFacts: contextualFacts, teamFocus: 'Home', teamSide: 'home', competitionContext: {}, potm: {} });
  assert.deepEqual(contextualDossier.authoritative_facts.historical_context, historicalContext);
  assert.deepEqual(contextualDossier.authoritative_facts.statistical_context, statisticalContext);
  assert.deepEqual(contextualDossier.authoritative_facts.league_context, leagueContext);
  assert.equal(contextualDossier.report_guidance.report_depth, 'full');
  await writeMatchReportV4({ dossier: contextualDossier, writerProvider: 'openai' });
  for (const call of create.mock.calls) {
    assert.match(call.arguments[0].messages[1].content, /Test Scorer has scored in 5 consecutive Championship matches/);
    assert.match(call.arguments[0].messages[1].content, /verified-statistical-evidence/);
    assert.match(call.arguments[0].messages[1].content, /verified-league-evidence/);
  }
});

test('canonical own goals credit the provider beneficiary and empty POTM falls back to ratings', () => {
  const { validateAuthoritativeMatchData, determinePOTM } = require('./services/reportPipeline');
  const match = { teams: { home: { team_id: 283, team_name: 'Wrexham' }, away: { team_id: 65, team_name: 'Southampton' } }, score: { home: 2, away: 1 }, events: [
    { minute: 35, type: 'GOAL', player: 'Kieffer Moore', participant_id: 283, team: 'home', result: '1-0' },
    { minute: 50, type: 'GOAL', player: 'James Ward-Prowse', participant_id: 65, team: 'away', result: '1-1' },
    { minute: 89, type: 'OWNGOAL', player: 'Keven Schlotterbeck', participant_id: 283, team: 'home', result: '2-1' }
  ], potm: { away: { player: '', rating: null } }, player_ratings: [{ player: 'James Ward-Prowse', rating: 8, team_id: 65 }] };
  const validated = validateAuthoritativeMatchData(match);
  assert.equal(validated.scoring_events[2].team, 'Wrexham');
  assert.equal(validated.goal_events_reconciled, true);
  assert.equal(determinePOTM(match, 'away').player, 'James Ward-Prowse');
});

test('Run 1 receives canonical match statistics and verified history', async () => {
  const stats = { home: [{ type_id: 45, type: 'Possession', value: 34 }], away: [{ type_id: 45, type: 'Possession', value: 66 }] };
  const history = { facts: [{ fact_id: 'verified-winless-run', text: 'Wrexham ended a 3-match winless run.' }] };
  const trace = {};
  mock.method(client.chat.completions, 'create', async () => ({ choices: [{ message: { content: '{}' } }] }));
  await interpretMatch({ match: { score: { home: 2, away: 1 }, statistics: stats, report_context: history }, teamSide: 'away', teamFocus: 'Southampton', trace });
  assert.deepEqual(trace.input_snapshot.stats, stats);
  assert.deepEqual(trace.input_snapshot.historical_context, history);
});

test('V4 cache prefix is identical across clubs and contains no match-specific dossier', async () => {
  process.env.CLAUDE_API_KEY = 'test-only';
  const post = mock.method(axios, 'post', async () => ({ data: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify(report) }] } }));
  const firstDossier = { ...dossier, focused_club: { name: 'First Club' }, report_guidance: { editorial_beats: ['unique-guidance'] } };
  await writeMatchReportV4({ dossier: firstDossier });
  await writeMatchReportV4({ dossier: { ...firstDossier, focused_club: { name: 'Second Club' } } });
  const first = post.mock.calls[0].arguments[1].messages[0].content;
  const second = post.mock.calls[1].arguments[1].messages[0].content;
  assert.equal(first[0].text, second[0].text);
  assert.deepEqual(first[0].cache_control, { type: 'ephemeral' });
  assert.ok(first[0].text.length > 5000);
  assert.doesNotMatch(first[0].text, /First Club|Second Club|unique-guidance/);
  assert.match(first[1].text, /First Club/);
  assert.match(second[1].text, /Second Club/);
  assert.ok(first[1].text.includes(JSON.stringify(firstDossier, null, 2)), 'The complete unmodified dossier must still be sent');
});

test('V4 accepts away winner-first scores, goalless prose, punctuation and historical results without repairs', async () => {
  process.env.CLAUDE_API_KEY = 'test-only';
  const cases = [
    { score: { home: 0, away: 1 }, headline: 'Away won 1-0', prose: 'A 1-0 away victory was secured late.' },
    { score: { home: 0, away: 0 }, headline: 'Neither side found a way through', prose: 'The match ended in a goalless draw.' },
    { score: { home: 2, away: 1 }, headline: 'A late breakthrough', prose: 'The match finished 2:1. Last season they recorded a 4-0 win.' },
    { score: { home: 0, away: 1 }, headline: 'A narrow defeat', prose: 'Home lost 1\u20130.' },
    { score: { home: 1, away: 1 }, headline: 'The points were shared', prose: 'Both sides scored once.' },
    { score: { home: 2, away: 1 }, headline: 'Home won 2-1', prose: 'A goalless draw at the break gave way to a busy second half.' }
  ];
  const post = mock.method(axios, 'post');
  for (const item of cases) {
    post.mock.mockImplementation(async () => ({ data: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({ ...report, headline: item.headline, summary_paragraphs: [item.prose] }) }] } }));
    const before = post.mock.callCount();
    await writeMatchReportV4({ dossier: { ...dossier, authoritative_facts: { ...facts, final_score: item.score } } });
    assert.equal(post.mock.callCount() - before, 1);
  }
});

test('incorrect final scores still trigger one repair with separately recorded usage', async () => {
  process.env.CLAUDE_API_KEY = 'test-only';
  const trace = {};
  let calls = 0;
  const post = mock.method(axios, 'post', async () => ({
    data: {
      id: `request-${++calls}`, stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 20, cache_creation_input_tokens: calls === 1 ? 80 : 0, cache_read_input_tokens: 0 },
      content: [{ type: 'text', text: JSON.stringify(calls === 1 ? { ...report, headline: 'A 3-0 victory' } : report) }]
    }
  }));
  await writeMatchReportV4({ dossier, trace });
  assert.equal(post.mock.callCount(), 2);
  assert.deepEqual(trace.requests.map(request => request.kind), ['initial', 'repair']);
  assert.deepEqual(trace.requests.map(request => request.request_id), ['request-1', 'request-2']);
  assert.equal(trace.requests[0].usage.cache_creation_input_tokens, 80);
  assert.equal(trace.requests[1].usage.output_tokens, 20);
});

test('winner-first notation cannot excuse explicitly claiming the losing club won', async () => {
  process.env.CLAUDE_API_KEY = 'test-only';
  let calls = 0;
  mock.method(axios, 'post', async () => ({
    data: { stop_reason: 'end_turn', content: [{ type: 'text', text: JSON.stringify({
      ...report,
      headline: ++calls === 1 ? 'Home won 1-0' : 'Home lost 1-0',
      summary_paragraphs: ['An away victory was secured late.']
    }) }] }
  }));
  await writeMatchReportV4({ dossier: { ...dossier, authoritative_facts: { ...facts, final_score: { home: 0, away: 1 } } } });
  assert.equal(calls, 2);
});

test('cache reads, truncated output and API failures retain accurate request-level usage', async () => {
  process.env.CLAUDE_API_KEY = 'test-only';
  const trace = {};
  const args = { ...getReportWriterConfig('claude'), prompt: 'match', systemPrompt: 'editor', trace };
  const post = mock.method(axios, 'post', async () => ({ data: { id: 'cached', stop_reason: 'max_tokens', usage: { input_tokens: 25, output_tokens: 16000, cache_read_input_tokens: 500 }, content: [] } }));
  await assert.rejects(completeReport(args), /max_tokens/);
  assert.equal(trace.requests[0].usage.cache_read_input_tokens, 500);
  assert.equal(trace.requests[0].stop_reason, 'max_tokens');
  post.mock.mockImplementation(async () => { throw new Error('network timeout'); });
  await assert.rejects(completeReport(args), /network\/timeout/);
  assert.equal(trace.requests[1].status, 'failed');
  assert.equal(trace.requests[1].usage, null, 'Unknown usage must not be presented as zero tokens');
});

test('Run 1 records its OpenAI model and usage, including cached prompt details', async () => {
  const trace = {};
  const usage = { prompt_tokens: 1234, completion_tokens: 321, total_tokens: 1555, prompt_tokens_details: { cached_tokens: 100 } };
  mock.method(client.chat.completions, 'create', async () => ({ id: 'run1-request', usage, choices: [{ message: { content: '{}' }, finish_reason: 'stop' }] }));
  await interpretMatch({ match: { score: { home: 0, away: 0 } }, teamFocus: 'Home', teamSide: 'home', trace });
  assert.equal(trace.provider, 'openai');
  assert.equal(trace.model, process.env.INTERPRETATION_MODEL || 'gpt-4o-mini');
  assert.deepEqual(trace.requests[0].usage, usage);
  assert.equal(trace.requests[0].request_id, 'run1-request');
});

test('V4 provider finish, assist and score progression override conflicting Run 1 details', () => {
  const scoringEvents = [
    { event_id: 1, minute: 35, scorer: 'Kieffer Moore', side: 'home', type: 'goal', result: '1-0', assist_provider: 'Ben Whiteman', finish_description: 'Right foot shot' },
    { event_id: 2, minute: 50, scorer: 'James Ward-Prowse', side: 'away', type: 'goal', result: '1-1', assist_provider: 'Samuel Edozie', finish_description: 'Right foot shot' }
  ];
  const interpretation = { scoring_evidence: [{ event_id: 1, minute: 35, scorer: 'Kieffer Moore', score_before: '2-0', score_after: '3-0', structured_details: { assist: 'Wrong Player', shot_type: 'header', finish_detail: 'top corner' } }] };
  const dossier = buildEditorialDossierV4({ interpretation, authoritativeMatchFacts: { final_score: { home: 1, away: 1 }, scoring_events: scoringEvents }, teamFocus: 'Southampton', teamSide: 'away', competitionContext: {}, potm: {} });
  const first = dossier.authoritative_facts.scoring_events[0];
  assert.equal(first.player_roles.shot_type, 'Right foot shot');
  assert.equal(first.player_roles.assist_provider, 'Ben Whiteman');
  assert.equal(first.player_roles.finish_detail, null);
  assert.equal(first.score_before, '0-0');
  assert.equal(first.score_after, '1-0');
  assert.equal(dossier.authoritative_facts.scoring_events[1].score_before, '1-0');
});