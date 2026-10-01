const assert = require('node:assert/strict');
const { test } = require('node:test');
const { isFinishedMatch, hasFinalScore, getProviderScore, hasConsistentScore, loadReportMatch } = require('./services/reportMatchReadiness');
const { buildHistoricalContext, loadHistoricalContext } = require('./services/reportHistoricalContext');

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