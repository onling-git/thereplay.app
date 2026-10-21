const test = require('node:test');
const assert = require('node:assert/strict');
const { buildTeamSlugCandidates, slugifyTeamName } = require('./utils/teamSlug');
const { mock, afterEach } = require('node:test');
const Team = require('./models/Team');
const { resolveTeamSlugParam } = require('./middleware/resolveTeamSlugParam');
afterEach(() => mock.restoreAll());

test('slugifyTeamName converts ampersand names to clean slugs', () => {
  assert.equal(slugifyTeamName('Brighton & Hove Albion'), 'brighton-and-hove-albion');
  assert.equal(slugifyTeamName('Queens  Park Rangers'), 'queens-park-rangers');
});

test('buildTeamSlugCandidates includes both public and legacy slug forms', () => {
  const candidates = buildTeamSlugCandidates('brighton-and-hove-albion');
  assert.ok(candidates.includes('brighton-and-hove-albion'));
  assert.ok(candidates.includes('brighton--hove-albion'));
});

test('clean ampersand URL resolves to the existing stored slug', async () => {
  mock.method(Team, 'findOne', () => ({ lean: async () => null }));
  mock.method(Team, 'find', () => ({ select: () => ({ lean: async () => [
    { name: 'Brighton & Hove Albion', slug: 'brighton--hove-albion' }
  ] }) }));
  const req = { params: {} };
  await resolveTeamSlugParam(req, {}, error => assert.ifError(error), 'brighton-and-hove-albion', 'teamName');
  assert.equal(req.params.teamName, 'brighton--hove-albion');
});

test('exact identifiers win over aliases and resolver failures propagate', async () => {
  mock.method(Team, 'findOne', () => ({ lean: async () => ({ slug: 'rock-and-roll' }) }));
  const req = { params: {} };
  await resolveTeamSlugParam(req, {}, error => assert.ifError(error), 'rock-and-roll', 'teamSlug');
  assert.equal(req.params.teamSlug, 'rock-and-roll');
  const failure = new Error('Database unavailable');
  mock.method(Team, 'findOne', () => ({ lean: async () => { throw failure; } }));
  await resolveTeamSlugParam(req, {}, error => assert.equal(error, failure), 'rock-and-roll', 'teamSlug');
});

test('does not guess aliases belonging to a different name', async () => {
  mock.method(Team, 'findOne', () => ({ lean: async () => null }));
  mock.method(Team, 'find', () => ({ select: () => ({ lean: async () => [
    { name: 'Rock Roll', slug: 'rock-roll' }
  ] }) }));
  const req = { params: {} };
  await resolveTeamSlugParam(req, {}, error => assert.ifError(error), 'rock-and-roll', 'teamSlug');
  assert.equal(req.params.teamSlug, 'rock-and-roll');
});
