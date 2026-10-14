import { render } from '@testing-library/react';
import MatchReportStructuredData from './MatchReportStructuredData';

const data = {
  match_id: 19729063,
  home_team: 'Southampton',
  away_team: 'Portsmouth',
  home_team_slug: 'southampton',
  report: {
    match_id: 19729063,
    team_slug: 'portsmouth',
    generated: {
      headline: "Bree's early strike holds",
      summary_paragraphs: ['Portsmouth could not find a way through.'],
    },
    images: ['https://thereplay.app/img/reports/19729063-portsmouth@16x9.jpg'],
    createdAt: '2026-10-17T21:58:00+01:00',
    updatedAt: '2026-10-18T10:00:00+01:00',
  },
};
const renderSchema = (payload = data, teamSlug = 'portsmouth', matchId = '19729063') =>
  render(<MatchReportStructuredData data={payload} teamSlug={teamSlug} matchId={matchId} />);
const readSchema = (container) =>
  JSON.parse(container.querySelector('script[type="application/ld+json"]').textContent);

test('renders report-specific content, dates, references and actual images', () => {
  const { container } = renderSchema();
  const url = 'https://thereplay.app/portsmouth/match/19729063/report';
  expect(readSchema(container)).toEqual({
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${url}#article`,
    url,
    mainEntityOfPage: url,
    headline: "Bree's early strike holds",
    description: 'Portsmouth could not find a way through.',
    image: data.report.images,
    datePublished: '2026-10-17T20:58:00.000Z',
    dateModified: '2026-10-18T09:00:00.000Z',
    author: {
      '@id': 'https://thereplay.app/#organization',
      '@type': 'Organization',
      name: 'The Replay',
      url: 'https://thereplay.app',
    },
    publisher: { '@id': 'https://thereplay.app/#organization' },
    isPartOf: {
      '@id': 'https://thereplay.app/#website',
      '@type': 'WebSite',
      name: 'The Replay',
      url: 'https://thereplay.app',
      publisher: { '@id': 'https://thereplay.app/#organization' },
    },
    about: [
      { '@id': 'https://thereplay.app/southampton/match/19729063#event' },
      { '@id': 'https://thereplay.app/portsmouth/' },
    ],
  });
});

test('opposing perspectives and other matches have distinct article identities', () => {
  const { container, rerender } = renderSchema();
  const awayId = readSchema(container)['@id'];
  const homeData = { ...data, report: { ...data.report, team_slug: 'southampton' } };
  rerender(<MatchReportStructuredData data={homeData} teamSlug="southampton" matchId="19729063" />);
  const homeId = readSchema(container)['@id'];
  expect(homeId).not.toBe(awayId);

  const anotherMatch = { ...data, match_id: 19729064, report: { ...data.report, match_id: 19729064 } };
  rerender(<MatchReportStructuredData data={anotherMatch} teamSlug="portsmouth" matchId="19729064" />);
  expect(new Set([awayId, homeId, readSchema(container)['@id']]).size).toBe(3);
  expect(container.querySelectorAll('script')).toHaveLength(1);
});

test('regeneration retains the article ID but uses the updated headline and date', () => {
  const { container, rerender } = renderSchema();
  const original = readSchema(container);
  const regenerated = {
    ...data,
    report: { ...data.report, generated: { headline: 'Updated headline' }, updatedAt: '2026-10-19T12:00:00Z' },
  };
  rerender(<MatchReportStructuredData data={regenerated} teamSlug="portsmouth" matchId="19729063" />);
  expect(readSchema(container)['@id']).toBe(original['@id']);
  expect(readSchema(container).datePublished).toBe(original.datePublished);
  expect(readSchema(container).dateModified).toBe('2026-10-19T12:00:00.000Z');
  expect(readSchema(container).headline).toBe('Updated headline');
});

test('uses older top-level content without inventing timestamps or images', () => {
  const { container } = renderSchema({
    ...data,
    report: { headline: 'Stored headline', summary_paragraphs: [' ', 'Summary'] },
  });
  const schema = readSchema(container);
  expect(schema.headline).toBe('Stored headline');
  expect(schema.description).toBe('Summary');
  expect(schema).not.toHaveProperty('image');
  expect(schema).not.toHaveProperty('datePublished');
  expect(schema).not.toHaveProperty('dateModified');
});

test('handles legacy string reports and missing home slug', () => {
  const { container } = renderSchema({ ...data, home_team_slug: undefined, report: 'Legacy text\nMore text' });
  const schema = readSchema(container);
  expect(schema.headline).toBe('Southampton vs Portsmouth Match Report');
  expect(schema.description).toBe('Legacy text');
  expect(schema.about[0]['@id']).toBe('https://thereplay.app/portsmouth/match/19729063#event');
  expect(schema).not.toHaveProperty('datePublished');
});

test.each([
  { ...data, report: null },
  { ...data, report: {} },
  { ...data, match_id: 1 },
  { ...data, report: { ...data.report, match_id: 1 } },
  { ...data, report: { ...data.report, team_slug: 'southampton' } },
])('omits missing, incomplete or mismatched reports', (payload) => {
  const { container } = renderSchema(payload);
  expect(container.querySelector('script')).toBeNull();
});

test('safely serializes script-closing stored text', () => {
  const headline = '</script><script>alert("test")</script>';
  const { container } = renderSchema({
    ...data, report: { ...data.report, generated: { headline } },
  });
  expect(container.querySelectorAll('script')).toHaveLength(1);
  expect(container.querySelector('script').textContent).not.toContain('<');
  expect(readSchema(container).headline).toBe(headline);
});
