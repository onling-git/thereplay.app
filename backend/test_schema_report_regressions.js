const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.OPENAI_API_KEY = 'test-only';
const Match = require('./models/Match');
const Venue = require('./models/Venue');
const sportmonks = require('./utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');
const { buildLiveMatchGraph } = require('./utils/liveMatchSchema');
const { validateAuthoritativeMatchData, determinePOTM } = require('./services/reportPipeline');
const { buildEditorialDossierV4 } = require('./services/reportEvidenceDossierV4');

function providerFixture() {
  return {
    id: 19729063,
    starting_at_timestamp: Date.parse('2026-09-17T19:00:00Z') / 1000,
    state: { id: 5, state: 'FT', short_name: 'FT', developer_name: 'FT', name: 'Finished' },
    participants: [
      { id: 65, name: 'Southampton', meta: { location: 'home' } },
      { id: 2, name: 'Portsmouth', meta: { location: 'away' } },
    ],
    scores: [
      { participant_id: 65, description: 'CURRENT', score: { participant: 'home', goals: 1 } },
      { participant_id: 2, description: 'CURRENT', score: { participant: 'away', goals: 0 } },
    ],
    events: [
      { id: 1, participant_id: 65, type_id: 14, player_id: 100, player_name: 'Bree', related_player_name: 'Armstrong', minute: 23, period_id: 1, result: '1-0', info: 'Right-footed finish' },
      { id: 2, participant_id: 65, type_id: 20, player_id: 101, player_name: 'Defender', minute: 60, period_id: 2 },
      { id: 3, participant_id: 2, type_id: 18, player_id: 201, player_name: 'Substitute', related_player_name: 'Starter', minute: 70, period_id: 2 },
    ],
    lineups: [
      { player_id: 100, team_id: 65, player_name: 'Bree', jersey_number: 14, position_id: 2, formation_field: '2:1', formation_position: 2, type_id: 11, details: [{ type_id: 118, player_id: 100, team_id: 65, data: { value: 8.1 } }] },
      { player_id: 200, team_id: 2, player_name: 'Keeper', jersey_number: 1, position_id: 1, formation_field: '1:1', formation_position: 1, type_id: 11, details: [{ type_id: 118, player_id: 200, team_id: 2, data: { value: 8.7 } }] },
    ],
    statistics: [
      { participant_id: 65, type_id: 45, type: { name: 'Possession' }, data: { value: 42 } },
      { participant_id: 2, type_id: 45, type: { name: 'Possession' }, data: { value: 58 } },
      { players: [{ player_name: 'Bree', goals: 1, shots: 2, shots_on_target: 1, minutes_played: 90, rating: 8.1 }] },
    ],
    comments: [{ comment_id: 1, fixture_id: 19729063, minute: 23, comment: 'Bree scores.', is_goal: true }],
    venue: { id: 65, name: "St Mary's Stadium", city_name: 'Southampton', capacity: 32384 },
    periods: [{ id: 1, started: 1789671600, ended: 1789674480, counts_from: 0 }, { id: 2, started: 1789675380, ended: 1789678320, counts_from: 45 }],
    detailedPeriods: [{ id: 20, period_id: 2, started: 1789675380, counts_from: 45 }],
    league: { id: 9, name: 'Championship' },
    season: { id: 10, name: '2026/27' },
  };
}

function reportInputs(match) {
  return {
    score: match.score, teams: match.teams, events: match.events, comments: match.comments,
    lineup: match.lineup, lineups: match.lineups, player_stats: match.player_stats,
    player_ratings: match.player_ratings, statistics: match.statistics,
    date: match.date, match_status: match.match_status,
  };
}

test('schema timing additions leave report, lineup, score and player-stat inputs unchanged', () => {
  const richFixture = providerFixture();
  const withoutSchemaTiming = structuredClone(richFixture);
  delete withoutSchemaTiming.periods;
  delete withoutSchemaTiming.detailedPeriods;
  const rich = normaliseFixtureToMatchDoc(richFixture);
  const originalInputs = normaliseFixtureToMatchDoc(withoutSchemaTiming);
  assert.deepEqual(reportInputs(rich), reportInputs(originalInputs));
  assert.deepEqual(rich.score, { home: 1, away: 0 });
  assert.equal(rich.lineup.home[0].rating, 8.1);
  assert.equal(rich.lineup.away[0].rating, 8.7);
  assert.equal(rich.lineups[0].details[0].data.value, 8.1);
  assert.equal(rich.player_stats.find(player => player.player === 'Bree').minutes_played, 90);
  assert.equal(rich.statistics.home[0].value, 42);
  assert.equal(rich.statistics.away[0].value, 58);
});

test('wrapped provider collections and grouped lineups retain ratings and team attribution', () => {
  const fixture = providerFixture();
  fixture.lineup = { data: [
    { team_id: 65, players: [fixture.lineups[0]] },
    { team_id: 2, players: [fixture.lineups[1]] },
  ] };
  delete fixture.lineups;
  for (const key of ['participants', 'events', 'scores', 'statistics', 'periods', 'detailedPeriods']) {
    fixture[key] = { data: fixture[key] };
  }
  const match = normaliseFixtureToMatchDoc(fixture);
  assert.equal(match.lineup.home[0].player_id, 100);
  assert.equal(match.lineup.home[0].rating, 8.1);
  assert.equal(match.lineup.away[0].rating, 8.7);
  assert.equal(match.events[0].team, 'home');
  assert.deepEqual(match.score, { home: 1, away: 0 });
  assert.equal(match.periods.length, 2);
});

test('schema construction cannot truncate or mutate the report event stream', () => {
  const match = normaliseFixtureToMatchDoc(providerFixture());
  match.events.push(...Array.from({ length: 45 }, (_, index) => ({
    id: 10 + index, type: 'YELLOWCARD', minute: 30 + index,
    participant_id: 2, player_name: 'Player', team: 'away',
  })));
  const before = structuredClone(match);
  const graph = buildLiveMatchGraph(match);
  assert.equal(graph['@graph'].find(node => node['@type'] === 'LiveBlogPosting').liveBlogUpdate.length, 40);
  assert.deepEqual(match, before);
  assert.equal(match.events.length, 48);
  const stored = new Match(match).toObject();
  assert.equal(stored.events.length, 48);
  assert.equal(stored.lineup.home[0].rating, 8.1);
  assert.equal(stored.match_info.venue.capacity, 32384);
  assert.equal(stored.events[0].period_id, 1);
});

test('normalised match data reaches the real report scoring ledger and both team dossiers', () => {
  const match = normaliseFixtureToMatchDoc(providerFixture());
  match.player_ratings = [
    { player: 'Bree', player_id: 100, team_id: 65, rating: 8.1 },
    { player: 'Keeper', player_id: 200, team_id: 2, rating: 8.7 },
  ];
  const facts = validateAuthoritativeMatchData(match);
  assert.equal(facts.goal_events_reconciled, true);
  assert.equal(facts.scoring_events[0].scorer, 'Bree');
  assert.equal(facts.scoring_events[0].assist_provider, 'Armstrong');
  assert.equal(facts.scoring_events[0].side, 'home');
  for (const [side, team, player, rating, result] of [
    ['home', 'Southampton', 'Bree', 8.1, 'won'],
    ['away', 'Portsmouth', 'Keeper', 8.7, 'lost'],
  ]) {
    const potm = determinePOTM(match, side);
    assert.equal(potm.player, player);
    assert.equal(potm.rating, rating);
    const dossier = buildEditorialDossierV4({
      interpretation: {}, authoritativeMatchFacts: facts, teamFocus: team,
      teamSide: side, competitionContext: { name: 'Championship', is_cup: false }, potm, match,
    });
    assert.equal(dossier.focused_club.result, result);
    assert.equal(dossier.supported_observations.potm.player, player);
    assert.equal(dossier.supported_observations.potm.rating, rating);
    assert.equal(dossier.verified_match_context.non_scoring_events.dismissals[0].player, 'Defender');
    assert.equal(dossier.verified_match_context.non_scoring_events.substitutions[0].player_on, 'Substitute');
  }
});

function loadSync(t, fixture, { schemaFailure = false, schemaWriteFailure = false, previousFT = false, providerGet } = {}) {
  const controllerPath = require.resolve('./controllers/matchSyncController');
  const reportPath = require.resolve('./controllers/reportController');
  const oldController = require.cache[controllerPath];
  const oldReport = require.cache[reportPath];
  const reports = [];
  require.cache[reportPath] = {
    id: reportPath, filename: reportPath, loaded: true,
    exports: { generateBothReports: async id => reports.push(id) },
  };
  delete require.cache[controllerPath];
  t.after(() => {
    if (oldController) require.cache[controllerPath] = oldController;
    else delete require.cache[controllerPath];
    if (oldReport) require.cache[reportPath] = oldReport;
    else delete require.cache[reportPath];
  });
  const stored = normaliseFixtureToMatchDoc(providerFixture());
  stored.match_status = { short_name: previousFT ? 'FT' : 'INPLAY_2ND_HALF' };
  stored.player_ratings = [{ player: 'Previously rated', player_id: 102, team_id: 65, rating: 7.2 }];
  const existing = new Match(stored);
  let saved;
  const schemaWrites = [];
  const warnings = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
  t.mock.method(sportmonks, 'get', providerGet || (async () => ({ data: { data: structuredClone(fixture) } })));
  t.mock.method(Match, 'findOne', async () => existing);
  t.mock.method(Match, 'findOneAndUpdate', async (_filter, update) => {
    saved = update.$set;
    const values = existing.toObject();
    for (const [key, value] of Object.entries(saved)) {
      if (key === 'match_info.venue') values.match_info.venue = value;
      else values[key] = value;
    }
    return new Match(values);
  });
  t.mock.method(Match, 'updateOne', async (_filter, update, options) => {
    if (schemaWriteFailure) throw new Error('Schema persistence unavailable');
    schemaWrites.push({ update, options });
    return { matchedCount: 1 };
  });
  t.mock.method(Venue, 'findOneAndUpdate', (_filter, update) => ({
    lean: async () => {
      if (schemaFailure) throw new Error('Venue registry unavailable');
      return { ...update.$set, ...update.$setOnInsert };
    },
  }));
  return { controller: require(controllerPath), reports, warnings, schemaWrites, payload: () => saved };
}

test('finished-match sync saves ratings, stats and events before triggering both reports', async t => {
  const loaded = loadSync(t, providerFixture());
  const updated = await loaded.controller.syncFinishedMatch(19729063);
  assert.deepEqual(loaded.reports, [19729063]);
  assert.equal(updated.lineup.home[0].rating, 8.1);
  assert.equal(updated.lineup.away[0].rating, 8.7);
  assert.equal(updated.lineups.length, 2);
  assert.equal(updated.lineups[0].player_id, 100);
  assert.equal(updated.lineups[0].player_name, 'Bree');
  assert.equal(updated.lineups[0].team_id, 65);
  assert.equal(updated.lineups[1].player_id, 200);
  assert.equal(updated.lineups[1].rating, 8.7);
  assert.equal(updated.player_ratings.find(player => player.player_id === 102).rating, 7.2);
  assert.equal(loaded.payload().player_stats.find(player => player.player === 'Bree').rating, 8.1);
  assert.equal(loaded.payload().statistics.home[0].value, 42);
  assert.equal(updated.events[0].type, 'GOAL');
  assert.equal(loaded.schemaWrites.length, 1);
  assert.deepEqual(Object.keys(loaded.schemaWrites[0].update.$set).sort(), ['structured_data', 'structured_data_frozen_at']);
  assert.equal(loaded.schemaWrites[0].options.timestamps, false);
});

test('a failed venue/schema refresh cannot block match persistence or automatic reports', async t => {
  const loaded = loadSync(t, providerFixture(), { schemaFailure: true });
  const updated = await loaded.controller.syncFinishedMatch(19729063);
  assert.equal(updated.lineup.home[0].rating, 8.1);
  assert.equal(updated.player_ratings.find(player => player.player_id === 100).rating, 8.1);
  assert.equal(updated.events[0].type, 'GOAL');
  assert.equal(updated.match_info.venue.name, "St Mary's Stadium");
  assert.deepEqual(loaded.reports, [19729063]);
  assert.ok(loaded.warnings.some(warning => warning.includes('structured data') && warning.includes('Venue registry unavailable')));
});

test('a failed schema-only write cannot block automatic reports', async t => {
  const loaded = loadSync(t, providerFixture(), { schemaWriteFailure: true });
  const updated = await loaded.controller.syncFinishedMatch(19729063);
  assert.equal(updated.lineup.home[0].rating, 8.1);
  assert.deepEqual(loaded.reports, [19729063]);
  assert.ok(loaded.warnings.some(warning => warning.includes('Schema persistence unavailable')));
});

test('a repeat FT sync without incoming ratings preserves existing ratings and does not regenerate reports', async t => {
  const fixture = providerFixture();
  for (const player of fixture.lineups) delete player.details;
  const loaded = loadSync(t, fixture, { previousFT: true });
  const updated = await loaded.controller.syncFinishedMatch(19729063);
  assert.equal(updated.player_ratings.length, 1);
  assert.equal(updated.player_ratings[0].rating, 7.2);
  assert.equal(updated.lineup.home[0].rating, 8.1);
  assert.deepEqual(loaded.reports, []);
});

test('core match persistence errors still fail the sync and cannot trigger reports', async t => {
  const loaded = loadSync(t, providerFixture());
  t.mock.method(Match, 'findOneAndUpdate', async () => { throw new Error('Match persistence unavailable'); });
  await assert.rejects(loaded.controller.syncFinishedMatch(19729063), /Match persistence unavailable/);
  assert.deepEqual(loaded.reports, []);
});

test('partial stats payload without kickoff uses the stored match date rather than dropping normalised report data', async t => {
  const fixture = providerFixture();
  delete fixture.starting_at_timestamp;
  const loaded = loadSync(t, fixture, { previousFT: true });
  const updated = await loaded.controller.syncFinishedMatch(19729063);
  assert.equal(updated.events[0].type, 'GOAL');
  assert.equal(loaded.payload().player_stats.find(player => player.player === 'Bree').minutes_played, 90);
  assert.equal(loaded.payload().statistics.home[0].value, 42);
  assert.deepEqual(loaded.reports, []);
});

test('provider requests fall back to the original rating includes if schema includes are unsupported', async t => {
  const fixture = providerFixture();
  const calls = [];
  const loaded = loadSync(t, fixture, { providerGet: async (_path, params) => {
    calls.push(params.include);
    if (params.include.split(';').includes('detailedPeriods') || params.include.split(';').includes('venue')) {
      throw new Error('Unsupported optional schema include');
    }
    return { data: { data: structuredClone(fixture) } };
  } });
  const fetched = await loaded.controller.fetchMatchStats(19729063, { forFinished: true, includeStatistics: true });
  assert.equal(fetched.lineups[0].details[0].data.value, 8.1);
  assert.equal(calls.length, 2);
  assert.ok(calls[1].includes('lineups.details'));
  assert.ok(calls[1].includes('statistics.type'));
});

function loadFixtureSync(t, { denyIncludes = false } = {}) {
  const controllerPath = require.resolve('./controllers/syncController');
  const oldController = require.cache[controllerPath];
  delete require.cache[controllerPath];
  t.after(() => {
    if (oldController) require.cache[controllerPath] = oldController;
    else delete require.cache[controllerPath];
  });
  const fixture = providerFixture();
  const warnings = [];
  const calls = [];
  const writes = [];
  t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
  t.mock.method(sportmonks, 'get', async (path, params) => {
    calls.push({ path, include: params?.include });
    if (denyIncludes && params?.include?.split(';').includes('detailedPeriods')) {
      const error = new Error('Unsupported optional schema include');
      error.response = { status: 422 };
      throw error;
    }
    return { data: { data: path.startsWith('/fixtures/') && !path.includes('/between/')
      ? structuredClone(fixture) : [structuredClone(fixture)] } };
  });
  t.mock.method(Match, 'findOne', () => ({ lean: async () => null }));
  t.mock.method(Match, 'findOneAndUpdate', (_filter, update) => ({
    lean: async () => {
      writes.push(update.$set);
      return new Match(update.$set).toObject();
    },
  }));
  const Team = require('./models/Team');
  t.mock.method(Team, 'findOne', () => ({ lean: async () => ({ id: 65, slug: 'southampton', name: 'Southampton' }) }));
  t.mock.method(Venue, 'findOneAndUpdate', () => ({
    lean: async () => { throw new Error('Venue registry unavailable'); },
  }));
  return { controller: require(controllerPath), warnings, calls, writes };
}

test('single-fixture, team-window and live sync remain successful when optional schema fails', async t => {
  for (const handler of ['syncFixture', 'syncTeamWindow', 'syncLiveNow']) {
    await t.test(handler, async t => {
      const loaded = loadFixtureSync(t, { denyIncludes: handler !== 'syncLiveNow' });
      const req = { params: { fixtureId: '19729063', teamSlug: 'southampton' }, query: {}, body: {} };
      const res = {
        statusCode: 200, payload: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.payload = payload; return this; },
      };
      await loaded.controller[handler](req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.payload.ok, true);
      assert.equal(loaded.writes.length, 1);
      assert.equal(loaded.writes[0].lineup.home[0].rating, 8.1);
      assert.equal(loaded.writes[0].events[0].type, 'GOAL');
      assert.ok(loaded.warnings.some(warning => warning.includes('structured data') && warning.includes('Venue registry unavailable')));
      if (handler === 'syncFixture') {
        assert.equal(res.payload.match_id, 19729063);
      } else {
        assert.equal(res.payload.upsertedCount, 1);
        assert.deepEqual(res.payload.match_ids, [19729063]);
      }
      if (handler !== 'syncLiveNow') {
        assert.equal(loaded.calls.length, 2);
        assert.ok(loaded.calls[1].include.includes('statistics.type'));
        assert.equal(loaded.calls[1].include.includes('detailedPeriods'), false);
      }
    });

  }
});

test('match-data API still returns lineup ratings and stats when the venue registry fails', async t => {
  const match = new Match(normaliseFixtureToMatchDoc(providerFixture())).toObject();
  const original = JSON.stringify(match);
  const Team = require('./models/Team');
  const warnings = [];
  t.mock.method(Team, 'findOne', () => ({ lean: async () => ({ name: 'Southampton' }) }));
  t.mock.method(Match, 'findOne', () => ({ lean: async () => match }));
  t.mock.method(Venue, 'findOneAndUpdate', () => ({
    lean: async () => { throw new Error('Venue registry unavailable'); },
  }));
  t.mock.method(console, 'warn', (...args) => warnings.push(args.join(' ')));
  const { getMatchByTeamAndId } = require('./controllers/matchController');
  const res = {
    json(payload) { this.payload = payload; },
    status() { assert.fail('Optional venue enrichment must not fail the match response'); },
  };
  await getMatchByTeamAndId({ params: { teamName: 'southampton', matchId: '19729063' }, query: {} }, res);
  assert.equal(JSON.stringify(res.payload), original);
  assert.equal(res.payload.lineup.home[0].rating, 8.1);
  assert.equal(res.payload.statistics.home[0].value, 42);
  assert.ok(warnings.some(warning => warning.includes('Venue enrichment failed')));
});
