const assert = require('node:assert/strict');
const { test } = require('node:test');
const { isFinishedMatch, hasFinalScore, getProviderScore, hasConsistentScore, loadReportMatch } = require('./services/reportMatchReadiness');
const { buildHistoricalContext, loadHistoricalContext } = require('./services/reportHistoricalContext');
const { buildStatisticalContext, loadXgContext } = require('./services/reportStatisticalContext');
const { buildLeagueContext, loadLeagueContext } = require('./services/reportLeagueContext');

const now = Date.parse('2026-10-01T12:00:00Z');
const finishedMatch = { match_id: 19729071, date: '2026-09-19T14:00:00Z', match_status: { state: 'FT' }, score: { home: 2, away: 1 } };

test('refreshes the stale Wrexham fixture and uses the reloaded final result', async () => {
  let synced = false;
  const result = await loadReportMatch(19729071, {
    now,
    loadMatch: async () => synced ? finishedMatch : { ...finishedMatch, match_status: { state: 'INPLAY_2ND_HALF' }, score: { home: 1, away: 0 } },
    syncMatch: async id => { assert.equal(id, 19729071); synced = true; }
  });
  assert.equal(synced, true);
  assert.deepEqual(result.score, { home: 2, away: 1 });
});

test('blocks unfinished data after refresh and on sync failure', async () => {
  const loadMatch = async () => ({ ...finishedMatch, match_status: { state: 'INPLAY_2ND_HALF' } });
  await assert.rejects(loadReportMatch(1, { now, loadMatch, syncMatch: async () => {} }), { status: 409 });
  await assert.rejects(loadReportMatch(1, { now, loadMatch, syncMatch: async () => { throw new Error('offline'); } }), /Could not refresh/);
});

test('does not sync or accept future or currently live matches', async () => {
  for (const date of ['2026-10-02T12:00:00Z', '2026-10-01T11:00:00Z']) {
    await assert.rejects(loadReportMatch(1, { now, loadMatch: async () => ({ ...finishedMatch, date, match_status: { state: 'INPLAY_1ST_HALF' } }), syncMatch: async () => assert.fail('Unexpected sync') }), { status: 409 });
  }
});

test('accepts completed cup states but not shootouts in progress or null scores', async () => {
  for (const state of ['FT', 'AET', 'FT_PEN']) assert.equal(isFinishedMatch({ match_status: { state } }), true);
  for (const state of ['PEN_LIVE', 'PEN_BREAK', 'ABANDONED', 'POSTPONED', 'INPLAY_2ND_HALF']) assert.equal(isFinishedMatch({ match_status: { state, short_name: 'FT' } }), false);
  assert.equal(hasFinalScore({ score: { home: null, away: 0 } }), false);
  assert.equal(hasFinalScore({ score: { home: '', away: 0 } }), false);
  assert.equal(await loadReportMatch(19729071, { now, loadMatch: async () => finishedMatch, syncMatch: async () => assert.fail('Unexpected sync') }), finishedMatch);
});

function fixture(id, home, away, events = [], overrides = {}) {
  return { match_id: id, date: `2026-09-${String(id).padStart(2, '0')}T14:00:00Z`, match_status: { state: 'FT' }, score: { home, away }, teams: { home: { team_id: 65, team_name: 'Southampton' }, away: { team_id: 283, team_name: 'Wrexham' } }, match_info: { season: { id: 10 }, league: { id: 9, name: 'Championship' } }, events, ...overrides };
}

const goal = (id, extra = {}) => ({ id, type: 'GOAL', participant_id: 65, player_id: 100, player_name: 'Test Scorer', ...extra });

test('derives team season totals and a win ending three winless games', () => {
  const history = [fixture(1, 1, 0), fixture(2, 0, 0), fixture(3, 0, 1), fixture(4, 1, 1)];
  const context = buildHistoricalContext({ match: fixture(5, 1, 0, [goal(5)]), histories: [{ team_id: 65, complete: true, matches: history }] });
  assert.deepEqual(context.teams[0].before_match, { played: 4, wins: 1, draws: 2, losses: 1, goals_for: 2, goals_against: 2, clean_sheets: 2 });
  assert.equal(context.teams[0].after_match.wins, 2);
  assert.match(context.facts.find(fact => fact.kind === 'winless_run_ended').text, /3-match winless/);
  assert.equal(context.teams[1].coverage.complete, false);
});

test('counts five consecutive scoring games, excluding other seasons, competitions and future games', () => {
  const history = [1, 2, 3, 4].map(id => fixture(id, 1, 0, [goal(id), goal(id)]));
  history.push(fixture(6, 4, 0), fixture(1, 5, 0, [], { match_id: 100, match_info: { season: { id: 11 }, league: { id: 9 } } }));
  history.push(fixture(2, 5, 0, [], { match_id: 101, match_info: { season: { id: 10 }, league: { id: 99 } } }));
  const context = buildHistoricalContext({ match: fixture(5, 1, 0, [goal(5)]), histories: [{ team_id: 65, complete: true, matches: [...history, history[0]] }] });
  assert.equal(context.players[0].season_goals_for_club, 5);
  assert.equal(context.players[0].consecutive_team_matches_scored_in, 5);
  assert.match(context.facts.find(fact => fact.kind === 'player_scoring_run').text, /5 consecutive/);
  assert.deepEqual(context.teams[0].source_match_ids, [1, 2, 3, 4, 5]);
});

test('counts dismissals per player per fixture and ignores rescinded cards', () => {
  const red = id => goal(id, { type: 'REDCARD' });
  const history = [fixture(1, 0, 0, [red(1), red(1), goal(2, { type: 'YELLOWREDCARD' })]), fixture(2, 0, 0, [{ ...red(3), rescinded: true }])];
  const context = buildHistoricalContext({ match: fixture(3, 0, 0, [red(4)]), histories: [{ team_id: 65, complete: true, matches: history }] });
  assert.equal(context.players[0].season_dismissals_for_club, 2);
  assert.match(context.facts.find(fact => fact.kind === 'repeat_dismissal').text, /sent off 2 times/);
});

test('suppresses claims for partial history, unfinished fixtures and incomplete goal ledgers', () => {
  const match = fixture(5, 1, 0, [goal(5)]);
  const history = [1, 2, 3, 4].map(id => fixture(id, 1, 0, [goal(id)]));
  assert.equal(buildHistoricalContext({ match, histories: [{ team_id: 65, complete: false, matches: history }] }).facts.length, 0);
  const incomplete = [...history.slice(0, 3), { ...history[3], match_status: { state: 'INPLAY_2ND_HALF' } }];
  assert.equal(buildHistoricalContext({ match, histories: [{ team_id: 65, complete: true, matches: incomplete }] }).facts.length, 0);
  history[2].events = [];
  const context = buildHistoricalContext({ match, histories: [{ team_id: 65, complete: true, matches: history }] });
  assert.equal(context.players.length, 0);
  assert.equal(context.teams[0].coverage.events_complete, false);
});

test('own goals and shootout goals do not count as player scoring form', () => {
  const ownGoal = goal(1, { type: 'OWNGOAL', player_name: 'Opponent', participant_id: 65 });
  const context = buildHistoricalContext({ match: fixture(2, 1, 0, [ownGoal, goal(2, { type: 'PENALTY_SHOOTOUT_GOAL' })]), histories: [{ team_id: 65, complete: true, matches: [fixture(1, 1, 0, [goal(3)])] }] });
  assert.equal(context.players.length, 0);
});

function providerFixture(id) {
  return { id, starting_at: `2026-09-${String(id).padStart(2, '0')} 14:00:00`, season_id: 10, league_id: 9, state: { state: 'FT' }, participants: [{ id: 65, name: 'Southampton', meta: { location: 'home' } }, { id: 283, name: 'Wrexham', meta: { location: 'away' } }], scores: [{ participant_id: 65, description: 'CURRENT', score: { goals: 1, participant: 'home' } }, { participant_id: 283, description: 'CURRENT', score: { goals: 0, participant: 'away' } }], events: [{ ...goal(id), type_id: 14 }] };
}

test('fetches every provider history page and verifies the target fixture', async () => {
  const match = fixture(5, 1, 0, [goal(5)]);
  match.match_info.season.starting_at = '2026-09-01';
  const calls = [];
  const get = async (path, params) => {
    calls.push({ path, params });
    return { data: { data: params.page === 1 ? [1, 2, 3].map(providerFixture) : [4, 5].map(providerFixture), pagination: { has_more: params.page === 1 } } };
  };
  const context = await loadHistoricalContext(match, { get });
  assert.equal(calls.length, 4);
  assert.equal(context.teams[0].coverage.complete, true);
  assert.equal(context.players[0].season_goals_for_club, 5);
  assert.equal(context.teams[0].coverage.source, 'Sportmonks season fixture history');
});

test('missing pagination, API failures, missing scores and provider mismatches suppress context', async () => {
  const match = fixture(5, 1, 0, [goal(5)]);
  match.match_info.season.starting_at = '2026-09-01';
  for (const get of [
    async () => { throw new Error('API unavailable'); },
    async () => ({ data: { data: [providerFixture(5)] } }),
    async () => ({ data: { data: [providerFixture(1)], pagination: { has_more: false } } }),
    async () => ({ data: { data: [{ ...providerFixture(5), scores: [] }], pagination: { has_more: false } } })
  ]) {
    const context = await loadHistoricalContext(match, { get });
    assert.equal(context.facts.length, 0);
    assert.equal(context.teams[0].coverage.complete, false);
  }
});

test('extracts both CURRENT scores, and rejects a cached score contradicted by events', async () => {
  assert.deepEqual(getProviderScore({ scores: [{ description: 'CURRENT', score: { participant: 'away', goals: 1 } }, { description: 'CURRENT', score: { participant: 'home', goals: 2 } }] }), { home: 2, away: 1 });
  assert.equal(getProviderScore({ scores: [] }), null);
  const stale = { ...finishedMatch, score: { home: 1, away: 0 }, events: [{ minute: 89, type: 'OWNGOAL', result: '2-1' }] };
  assert.equal(hasConsistentScore(stale), false);
  let synced = false;
  const result = await loadReportMatch(1, { now, loadMatch: async () => synced ? finishedMatch : stale, syncMatch: async () => { synced = true; } });
  assert.deepEqual(result.score, { home: 2, away: 1 });
});

test('normalizes nested Sportmonks statistics and preserves real zero values', () => {
  const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');
  const raw = providerFixture(5);
  raw.statistics = [{ participant_id: '65', type_id: 34, type: { name: 'Corners' }, data: { value: 0 } }, { participant_id: 283, type_id: 34, type: { name: 'Corners' }, value: 2 }];
  const normalized = normaliseFixtureToMatchDoc(raw);
  assert.equal(normalized.statistics.home[0].value, 0);
  assert.equal(normalized.statistics.away[0].value, 2);
});

test('statistical context preserves available metrics without inventing final-third accuracy or turnovers', () => {
  const match = fixture(5, 1, 0);
  match.statistics = { home: [{ type_id: 42, type: 'Shots Total', value: 20 }, { type_id: 86, type: 'Shots On Target', value: 7 }, { type_id: 82, type: 'Successful Passes Percentage', value: 90 }, { type_id: 581, type: 'Big Chances Missed', value: 3 }, { type_id: 57, type: 'Saves', value: 0 }] };
  const metrics = buildStatisticalContext(match).teams[0].metrics;
  assert.equal(metrics.shots_on_target_pct, 35);
  assert.equal(metrics.overall_pass_accuracy_pct, 90);
  assert.equal(metrics.big_chances_missed, 3);
  assert.equal(metrics.saves, 0);
  assert.equal(metrics.final_third_pass_accuracy_pct, null);
  assert.equal(metrics.turnovers_conceded, null);
  assert.equal(metrics.expected_goals, null);
});

test('xG is optional, preserves zero, excludes xG on target, and tolerates denied access', async () => {
  const match = fixture(5, 1, 0);
  const get = async () => ({ data: { data: { id: 5, xgfixture: [{ team_id: 65, type: { name: 'Expected Goals' }, data: { value: 0 } }, { team_id: 283, type: { name: 'Expected Goals on Target' }, data: { value: 2 } }, { team_id: 283, type: { code: 'expected-goals' }, data: { value: 1.2 } }] } } });
  const xg = await loadXgContext(match, { get });
  assert.equal(xg.home, 0);
  assert.equal(xg.away, 1.2);
  assert.equal(buildStatisticalContext(match, xg).teams[0].metrics.expected_goals, 0);
  const denied = await loadXgContext(match, { get: async () => { throw { response: { status: 403 } }; } });
  assert.equal(denied.available, false);
  assert.equal(denied.home, null);
  assert.equal(denied.reason, 'subscription_unavailable');
  const empty = await loadXgContext(match, { get: async () => ({ data: { data: { id: 5, xgfixture: [] } } }) });
  assert.equal(empty.available, false);
});

function leagueEvidence() {
  const match = fixture(5, 1, 0);
  match.match_info.round = { id: 100 };
  const round = { id: 100, name: '8', season_id: 10, league_id: 9, stage_id: 200, finished: true, starting_at: '2026-09-04', ending_at: '2026-09-06', fixtures: [{ id: 5 }] };
  const row = (participant_id, position, points, rule) => ({ participant_id, position, points, round_id: 100, season_id: 10, league_id: 9, stage_id: 200, details: [{ type_id: 129, value: 8 }], rule: rule ? { type: { code: rule } } : null });
  const table = [row(65, 1, 10), row(22, 2, 8), row(33, 3, 7, 'relegation'), row(283, 4, 5, 'relegation')];
  const schedules = {};
  for (const teamId of [65, 283]) schedules[teamId] = [{ id: 200, season_id: 10, type_id: 223, rounds: [{ fixtures: Array.from({ length: 14 }, (_, index) => ({ id: index + 1, season_id: 10, stage_id: 200, participants: [{ id: teamId }] })) }] }];
  return { match, round, table, schedules, now };
}

test('official points preserve sanctions and league gaps use the actual rules and scheduled games', () => {
  const input = leagueEvidence();
  input.corrections = [{ id: 1, participant_id: 65, season_id: 10, stage_id: 200, active: true, calc_type: '-', value: 4 }];
  const result = buildLeagueContext(input);
  assert.equal(result.available, true);
  assert.equal(result.scope, 'end_of_round');
  assert.equal(result.teams[0].official_points, 10);
  assert.equal(result.teams[0].current_provider_sanctions[0].value, 4);
  assert.equal(result.teams[1].bottom, true);
  assert.equal(result.teams[1].safety.points_behind_safety, 3);
  assert.equal(result.teams[1].regular_season_games_remaining, 6);
});

test('unknown rules and schedules stay null; incomplete or mismatched round tables are unavailable', () => {
  const input = leagueEvidence();
  const noRules = buildLeagueContext({ ...input, schedules: {}, table: input.table.map(row => ({ ...row, rule: null })) });
  assert.equal(noRules.teams[1].safety, null);
  assert.equal(noRules.teams[1].regular_season_games_remaining, null);
  for (const round of [{ ...input.round, finished: false }, { ...input.round, ending_at: '2026-12-01' }, { ...input.round, season_id: 99 }]) assert.equal(buildLeagueContext({ ...input, round }).available, false);
  assert.equal(buildLeagueContext({ ...input, table: input.table.slice(1) }).available, false);
  const differentPlayed = { ...input.match, report_context: { teams: [{ team_id: 65, coverage: { complete: true }, after_match: { played: 9 } }] } };
  assert.equal(buildLeagueContext({ ...input, match: differentPlayed }).teams.some(team => team.team_id === 65), false);
});

test('cup reports and standings API failures do not block generation', async () => {
  const { match } = leagueEvidence();
  assert.equal((await loadLeagueContext(match, { isCup: true, get: async () => assert.fail('Cup request') })).available, false);
  assert.equal((await loadLeagueContext(match, { get: async () => { throw new Error('offline'); } })).available, false);
});