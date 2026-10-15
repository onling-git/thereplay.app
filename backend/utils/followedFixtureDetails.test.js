const { test } = require('node:test');
const assert = require('node:assert/strict');
const Team = require('../models/Team');
const { currentSeasonFilter, enrichFixtureBadges } = require('./followedFixtureDetails');

test('current-season query uses season boundaries or current metadata when boundaries are missing', () => {
  const now = new Date('2026-10-15T12:00:00Z');
  assert.deepEqual(currentSeasonFilter(now), {
    $or: [
      {
        'match_info.season.starting_at': { $lte: now },
        'match_info.season.ending_at': { $gte: now },
      },
      {
        'match_info.season.is_current': true,
        $and: [
          { $or: [
            { 'match_info.season.starting_at': null },
            { 'match_info.season.starting_at': { $lte: now } },
          ] },
          { $or: [
            { 'match_info.season.ending_at': null },
            { 'match_info.season.ending_at': { $gte: now } },
          ] },
        ],
      },
    ],
  });
});

test('bulk enrichment supplies missing badges and slugs without replacing existing badges or scores', async (t) => {
  let query;
  t.mock.method(Team, 'find', (filter) => {
    query = filter;
    return { select: () => ({ lean: async () => [
      { id: 1, image_path: '/home.png', slug: 'home' },
      { id: 2, image_path: '/away.png', slug: 'away' },
    ] }) };
  });
  const [match] = await enrichFixtureBadges([{
    match_id: 10,
    score: { home: 0, away: 2 },
    reports: { away: 'report-id' },
    teams: { home: { team_id: '1' }, away: { team_id: 2, logo: '/existing.png' } },
  }]);
  assert.deepEqual(query, { id: { $in: ['1', 2] } });
  assert.equal(match.teams.home.logo, '/home.png');
  assert.equal(match.teams.home.team_slug, 'home');
  assert.equal(match.teams.away.logo, '/existing.png');
  assert.equal(match.teams.home.has_report, false);
  assert.equal(match.teams.away.has_report, true);
  assert.deepEqual(match.score, { home: 0, away: 2 });
});
