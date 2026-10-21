const { test, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const Team = require('./models/Team');
const policy = require('./services/reportGenerationPolicy');

afterEach(() => mock.restoreAll());

test('all staging generation is disabled, including Railway when NODE_ENV is production', () => {
  assert.match(policy.generationDisabledReason({ NODE_ENV: 'staging' }), /staging/);
  assert.match(policy.generationDisabledReason({ NODE_ENV: 'production', RAILWAY_ENVIRONMENT_NAME: 'staging' }), /staging/);
  assert.match(policy.generationDisabledReason({ REPORT_GENERATION_ENABLED: 'false' }), /disabled/);
  assert.equal(policy.generationDisabledReason({ NODE_ENV: 'production', RAILWAY_ENVIRONMENT_NAME: 'production' }), null);
});

test('report eligibility delegates to selected club and competition coverage', async () => {
  mock.method(require('./services/coveragePolicy'), 'assertReportTeam', async (_match, team) => {
    if (team.id !== 1) throw Object.assign(new Error('Outside selected coverage'), { code: 'REPORT_TEAM_NOT_ELIGIBLE' });
    return team;
  });
  mock.method(Team, 'findOne', query => ({ lean: async () => ({
    id: query.id, country_id: query.id === 1 ? 462 : 32
  }) }));
  const match = { match_id: 123, teams: {
    home: { team_id: 1, team_slug: 'english-club' },
    away: { team_id: 2, team_slug: 'spanish-club' }
  } };
  await policy.assertEnglishReportTeam(match, 'english-club');
  await assert.rejects(policy.assertEnglishReportTeam(match, 'spanish-club'), { code: 'REPORT_TEAM_NOT_ELIGIBLE' });
});

test('unknown teams and missing country metadata fail closed', async () => {
  mock.method(Team, 'findOne', () => ({ lean: async () => null }));
  await assert.rejects(policy.assertEnglishReportTeam({}, 'unknown'), { status: 403 });
});

test('automatic eligibility rejects unconfirmed, missing, contradictory and future results', () => {
  const match = { date: new Date(Date.now() - 2 * 60 * 60 * 1000), match_status: { state: 'FT' }, score: { home: 1, away: 0 } };
  assert.equal(policy.automaticMatchSkipReason(match), null);
  for (const change of [
    { match_status: { state: 'NS' } }, { score: { home: null, away: null } },
    { date: new Date(Date.now() + 60 * 60 * 1000) },
    { events: [{ type: 'goal', minute: 90, result: '2-0' }] }
  ]) assert.match(policy.automaticMatchSkipReason({ ...match, ...change }), /confirmed/);
});

test('activation does not schedule a historical paid-report backlog', async () => {
  mock.method(require('./models/League'), 'findOne', () => ({
    select() { return this; }, lean: async () => ({ reports_start_at: new Date('2026-10-21T08:00:00Z') })
  }));
  const match = { date: new Date('2026-10-20T15:00:00Z'), match_info: { league: { id: 8 } }, match_status: { state: 'FT' }, score: { home: 1, away: 0 } };
  assert.match(await policy.automaticReportSkipReason(match), /predates report activation/);
});
