process.env.OPENAI_API_KEY = 'test-only';
const { test, mock, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const Match = require('./models/Match');
const outcome = require('./services/matchOutcome');
const { validateAuthoritativeMatchData } = require('./services/reportPipeline');
const { buildEditorialDossierV4 } = require('./services/reportEvidenceDossierV4');
const { validateReport } = require('./services/matchReportWriterV4');

afterEach(() => mock.restoreAll());

const kick = (order, team, scored, player) => ({
  id: 900 + order, type: scored ? 'PENALTY_SHOOTOUT_GOAL' : 'PENALTY_SHOOTOUT_MISS',
  minute: order, sort_order: order, team, player_name: player || `${team} taker ${order}`,
  result: 'ignored', participant_id: team === 'home' ? 8 : 18
});

function shootoutMatch() {
  return {
    match_id: 19884061, home_team: 'Liverpool', away_team: 'Chelsea', home_team_slug: 'liverpool', away_team_slug: 'chelsea',
    teams: { home: { team_id: 8, team_name: 'Liverpool' }, away: { team_id: 18, team_name: 'Chelsea' } },
    match_status: { state: 'FT_PEN', short_name: 'FTP' }, score: { home: 1, away: 1 },
    events: [
      { id: 1, type: 'GOAL', minute: 40, team: 'away', participant_id: 18, player_name: 'Cole Palmer', result: '0-1' },
      { id: 2, type: 'GOAL', minute: 43, team: 'home', participant_id: 8, player_name: 'Mohamed Salah', result: '1-1' },
      kick(1, 'home', true), kick(2, 'away', true), kick(3, 'home', true), kick(4, 'away', false)
    ]
  };
}

test('extra-time and penalty finishes count as finished; live periods do not', () => {
  for (const state of ['FT', 'AET', 'FT_PEN', 'FTP', 'After Penalties', 'After Extra Time']) assert.equal(outcome.isFinishedState(state), true, state);
  for (const state of ['ET', 'PEN_LIVE', 'BREAK', 'INPLAY_2ND_HALF', '', null]) assert.equal(outcome.isFinishedState(state), false, String(state));
  const values = outcome.finishedMatchQuery().$or.find(clause => clause['match_status.state'])['match_status.state'].$in;
  assert.ok(values.includes('FT_PEN') && values.includes('AET') && values.includes('FT'));
});

test('shootout result is derived from shootout kicks and excluded from the goal ledger', () => {
  const match = shootoutMatch();
  assert.deepEqual(outcome.getMatchDecision(match).penalty_shootout && {
    home: outcome.getMatchDecision(match).penalty_shootout.home,
    away: outcome.getMatchDecision(match).penalty_shootout.away,
    winner: outcome.getMatchDecision(match).penalty_shootout.winner_side
  }, { home: 2, away: 1, winner: 'home' });
  assert.equal(outcome.focusedOutcome({ score: match.score, side: 'home', penaltyShootout: outcome.getPenaltyShootout(match) }), 'won on penalties');
  assert.equal(outcome.focusedOutcome({ score: match.score, side: 'away', penaltyShootout: outcome.getPenaltyShootout(match) }), 'lost on penalties');
  assert.equal(outcome.getMatchDecision({ match_status: { state: 'AET' }, events: [] }).decided_by, 'extra_time');
  assert.equal(outcome.getMatchDecision({ match_status: { state: 'FT' }, events: [] }).decided_by, 'normal_time');

  const facts = validateAuthoritativeMatchData(match);
  assert.equal(facts.decided_by, 'penalties');
  assert.equal(facts.penalty_shootout.winner_side, 'home');
  assert.deepEqual(facts.scoring_events.map(event => event.minute), [40, 43]);
  assert.equal(facts.goal_events_reconciled, true);
});

test('dossier and writer validation describe a shootout as a win or loss on penalties', () => {
  const match = shootoutMatch();
  const facts = validateAuthoritativeMatchData(match);
  const dossier = buildEditorialDossierV4({ interpretation: {}, authoritativeMatchFacts: facts, teamFocus: 'Chelsea', teamSide: 'away', competitionContext: { name: 'Carabao Cup', is_cup: true }, potm: {}, match });
  assert.equal(dossier.focused_club.result, 'lost on penalties');
  assert.equal(dossier.focused_club.scoreline, '1-1 (1-2 on penalties)');
  assert.equal(dossier.authoritative_facts.decided_by, 'penalties');

  const report = paragraphs => ({ headline: 'Chelsea out of the Carabao Cup', summary_paragraphs: paragraphs });
  assert.deepEqual(validateReport(report(['Chelsea lost 2-1 on penalties after a 1-1 draw at Anfield.']), dossier), []);
  assert.match(validateReport(report(['Chelsea drew 1-1 and the tie ended there.']), dossier)[0], /lost on penalties/);
  assert.match(validateReport(report(['Chelsea lost 3-1 on penalties.']), dossier)[0], /Correct the stated final result/);

  const normal = { ...match, match_status: { state: 'FT' }, score: { home: 1, away: 1 }, events: match.events.slice(0, 2) };
  const normalDossier = buildEditorialDossierV4({ interpretation: {}, authoritativeMatchFacts: validateAuthoritativeMatchData(normal), teamFocus: 'Chelsea', teamSide: 'away', competitionContext: {}, potm: {}, match: normal });
  assert.equal(normalDossier.focused_club.result, 'drew');
  assert.match(validateReport(report(['Chelsea won 1-1.']), normalDossier)[0], /Chelsea drew/);
});

test('the instant full-time trigger generates reports for matches settled on penalties', async () => {
  const policy = require('./services/reportGenerationPolicy');
  mock.method(policy, 'generationDisabledReason', () => null);
  mock.method(policy, 'automaticMatchSkipReason', () => null);
  mock.method(require('./utils/reportMonitoring'), 'monitorMatchReports', async () => ({ success: true }));
  const pen = { ...shootoutMatch(), reports: {} };
  const aet = { ...shootoutMatch(), match_id: 2, match_status: { state: 'AET' }, reports: {} };
  const live = { ...shootoutMatch(), match_id: 3, match_status: { state: 'PEN_LIVE' }, reports: {} };
  mock.method(Match, 'find', () => ({ select() { return this; }, lean: async () => [pen, aet, live] }));
  const post = mock.method(axios, 'post', async () => ({ data: {} }));
  mock.timers.enable({ apis: ['setTimeout'] });
  const path = require.resolve('./utils/enhancedReportMonitoring');
  const previous = require.cache[path];
  delete require.cache[path];
  try {
    const run = require(path).enhancedFinishedMatchCheck([19884061, 2, 3], { 19884061: 'PEN_LIVE', 2: 'ET', 3: 'ET' });
    for (let index = 0; index < 5; index++) { await new Promise(resolve => setImmediate(resolve)); mock.timers.tick(2000); }
    await run;
    assert.deepEqual(post.mock.calls.map(call => call.arguments[0].match(/match\/(\d+)\//)[1]).sort(), ['19884061', '2']);
  } finally {
    require.cache[path] = previous;
  }
});

test('missing-report and backup sweeps query extra-time and penalty finishes', async () => {
  const leagues = require('./utils/leagueHelper');
  mock.method(leagues, 'getEnabledLeagueIds', async () => [27]);
  const policy = require('./services/reportGenerationPolicy');
  mock.method(policy, 'generationDisabledReason', () => null);
  const find = mock.method(Match, 'find', () => ({ lean: async () => [] }));
  const path = require.resolve('./utils/reportMonitoring');
  const previous = require.cache[path];
  delete require.cache[path];
  try {
    await require(path).checkMissingReports({ hoursBack: 48 });
    const query = JSON.stringify(find.mock.calls[0].arguments[0]);
    assert.ok(query.includes('FT_PEN') && query.includes('AET'));
  } finally { require.cache[path] = previous; }
});
