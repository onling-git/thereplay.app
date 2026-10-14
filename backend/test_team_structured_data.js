const { test } = require('node:test');
const assert = require('node:assert/strict');
const Team = require('./models/Team');

test('new teams have Football and empty identity links by default', () => {
  const team = new Team({ name: 'Southampton', slug: 'southampton', id: 65 });
  assert.equal(team.sport, 'Football');
  assert.deepEqual(team.sameAs.toObject(), []);
  assert.equal(team.validateSync(), undefined);
});

test('identity URLs can be populated and serialized for the team endpoint', () => {
  const sameAs = [
    'https://www.wikidata.org/wiki/Q10487',
    'https://en.wikipedia.org/wiki/Southampton_F.C.'
  ];
  const team = new Team({ name: 'Southampton FC', slug: 'southampton', sameAs });
  assert.equal(team.validateSync(), undefined);
  assert.deepEqual(team.toObject().sameAs, sameAs);
});

test('invalid identity links produce a Mongoose validation error', () => {
  for (const url of ['', 'southampton', '/wiki/Q10487', 'javascript:alert(1)', 'ftp://example.com']) {
    const team = new Team({ name: 'Southampton', sameAs: [url] });
    assert.match(team.validateSync().errors.sameAs.message, /absolute HTTP or HTTPS URLs/);
  }
});
