const { test } = require('node:test');
const assert = require('node:assert/strict');
const Report = require('./models/Report');

test('reports default to an empty image array without fabricated URLs', () => {
  const report = new Report({ match_id: 19729063, team_id: 19, team_slug: 'portsmouth' });
  assert.deepEqual(report.toObject().images, []);
  assert.equal(report.validateSync(), undefined);
});

test('real report image URLs and stored dates survive serialization', () => {
  const images = ['https://thereplay.app/img/reports/19729063-portsmouth@16x9.jpg'];
  const createdAt = new Date('2026-10-17T20:58:00Z');
  const updatedAt = new Date('2026-10-18T09:00:00Z');
  const report = new Report({
    match_id: 19729063, team_id: 19, team_slug: 'portsmouth',
    images, createdAt, updatedAt
  });
  assert.equal(report.validateSync(), undefined);
  const serialized = report.toObject();
  assert.deepEqual(serialized.images, images);
  assert.deepEqual(serialized.createdAt, createdAt);
  assert.deepEqual(serialized.updatedAt, updatedAt);
});

test('invalid article image URLs produce validation errors', () => {
  for (const image of ['', 'javascript:alert(1)', '/img/report.jpg', 'ftp://example.com/report.jpg']) {
    const report = new Report({ match_id: 19729063, team_id: 19, images: [image] });
    assert.match(report.validateSync().errors.images.message, /absolute HTTP or HTTPS URLs/);
  }
});
