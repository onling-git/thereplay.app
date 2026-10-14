import { render } from '@testing-library/react';
import SportsTeamStructuredData from './SportsTeamStructuredData';

const team = { name: 'Southampton FC', slug: 'southampton' };
const readGraph = (container) => JSON.parse(
  container.querySelector('script[type="application/ld+json"]').textContent
);
const readSchema = (container) => readGraph(container)['@graph'][0];

test('renders the SportsTeam shape using the stored name and production URL', () => {
  const sameAs = [
    'https://www.wikidata.org/wiki/Q10487',
    'https://en.wikipedia.org/wiki/Southampton_F.C.',
  ];
  const { container } = render(<SportsTeamStructuredData team={{ ...team, sameAs }} />);

  expect(readSchema(container)).toEqual({
    '@type': 'SportsTeam',
    '@id': 'https://thereplay.app/southampton/',
    name: 'Southampton FC',
    sport: 'Football',
    sameAs,
  });
  expect(readGraph(container)['@context']).toBe('https://schema.org');
});

test.each([undefined, [], [' ', '']])('omits unpopulated sameAs (%j)', (sameAs) => {
  const { container } = render(<SportsTeamStructuredData team={{ ...team, sameAs }} />);
  expect(readSchema(container)).not.toHaveProperty('sameAs');
});

test('uses the stored sport and does not invent a name suffix', () => {
  const { container } = render(
    <SportsTeamStructuredData team={{ ...team, name: 'Southampton', sport: 'Rugby' }} />
  );
  expect(readSchema(container).name).toBe('Southampton');
  expect(readSchema(container).sport).toBe('Rugby');
});

test('escapes script-closing text without changing the parsed team name', () => {
  const name = 'Team </script><script>alert("test")</script>';
  const { container } = render(<SportsTeamStructuredData team={{ ...team, name }} />);
  expect(container.querySelectorAll('script')).toHaveLength(1);
  expect(container.querySelector('script').textContent).not.toContain('<');
  expect(readSchema(container).name).toBe(name);
});

test.each([null, { slug: 'southampton' }, { name: 'Southampton' }])(
  'does not output an incomplete team (%j)',
  (incompleteTeam) => {
    const { container } = render(<SportsTeamStructuredData team={incompleteTeam} />);
    expect(container.querySelector('script')).toBeNull();
  }
);

test('replaces rather than duplicates the schema and removes it on unmount', () => {
  const { container, rerender, unmount } = render(<SportsTeamStructuredData team={team} />);
  rerender(<SportsTeamStructuredData team={{ name: 'Arsenal', slug: 'arsenal' }} />);
  expect(container.querySelectorAll('script')).toHaveLength(1);
  expect(readSchema(container)['@id']).toBe('https://thereplay.app/arsenal/');
  unmount();
  expect(container.querySelector('script')).toBeNull();
});

const nextMatch = {
  match_id: 19729071,
  opponent_name: 'Norwich',
  opponent_slug: 'norwich',
  home_game: true,
  date: '2026-10-24T15:00:00+01:00',
  status: 'upcoming',
};
const readEvent = (container) =>
  readGraph(container)['@graph'].find((node) => node['@type'] === 'SportsEvent');

test('links the WebPage to the existing team, website and organization identities', () => {
  const { container } = render(<SportsTeamStructuredData team={team} />);
  const graph = readGraph(container)['@graph'];
  expect(graph).toHaveLength(2);
  expect(graph[1]).toEqual({
    '@type': 'WebPage',
    '@id': 'https://thereplay.app/southampton#webpage',
    url: 'https://thereplay.app/southampton',
    isPartOf: {
      '@type': 'WebSite', '@id': 'https://thereplay.app/#website',
      name: 'The Replay', url: 'https://thereplay.app',
    },
    about: { '@id': graph[0]['@id'] },
    provider: {
      '@type': 'Organization', '@id': 'https://thereplay.app/#organization',
      name: 'The Replay', url: 'https://thereplay.app',
    },
  });
});

test('describes the next card using home/away ordering and the actual kickoff', () => {
  const { container } = render(<SportsTeamStructuredData team={team} nextMatch={nextMatch} />);
  expect(readEvent(container)).toEqual({
    '@type': 'SportsEvent',
    '@id': 'https://thereplay.app/southampton/match/19729071#event',
    name: 'Southampton FC vs Norwich',
    startDate: '2026-10-24T14:00:00.000Z',
    eventStatus: 'https://schema.org/EventScheduled',
    homeTeam: { '@id': 'https://thereplay.app/southampton/' },
    awayTeam: { '@type': 'SportsTeam', '@id': 'https://thereplay.app/norwich/', name: 'Norwich' },
    sport: 'Football',
  });
  expect(readGraph(container)['@graph'][1].mentions).toEqual({ '@id': readEvent(container)['@id'] });
});

test('both team hubs use the same event identity with correct home and away teams', () => {
  const { container, rerender } = render(<SportsTeamStructuredData team={team} nextMatch={nextMatch} />);
  const id = readEvent(container)['@id'];
  rerender(
    <SportsTeamStructuredData
      team={{ name: 'Norwich', slug: 'norwich' }}
      nextMatch={{ ...nextMatch, home_game: false, opponent_name: team.name, opponent_slug: team.slug }}
    />
  );
  expect(readEvent(container)['@id']).toBe(id);
  expect(readEvent(container).name).toBe('Southampton FC vs Norwich');
  expect(readEvent(container).homeTeam['@id']).toBe('https://thereplay.app/southampton/');
  expect(readEvent(container).awayTeam['@id']).toBe('https://thereplay.app/norwich/');
});

test.each([
  ['NS', 'EventScheduled'],
  ['cancelled', 'EventCancelled'],
  ['CANC', 'EventCancelled'],
  ['postponed', 'EventPostponed'],
  ['POSTP', 'EventPostponed'],
])('maps %s to %s rather than assuming scheduled', (status, schemaStatus) => {
  const { container } = render(
    <SportsTeamStructuredData team={team} nextMatch={{ ...nextMatch, status }} />
  );
  expect(readEvent(container).eventStatus).toBe(`https://schema.org/${schemaStatus}`);
});

test.each(['FT', 'live', 'unknown', 'abandoned'])(
  'does not invent an eventStatus for %s', (status) => {
    const { container } = render(
      <SportsTeamStructuredData team={team} nextMatch={{ ...nextMatch, status }} />
    );
    expect(readEvent(container)).not.toHaveProperty('eventStatus');
  }
);

test('honors the provider status object over a default card status', () => {
  const { container } = render(
    <SportsTeamStructuredData team={team} nextMatch={{
      ...nextMatch, _fullMatch: { match_status: { developer_name: 'POSTP' } },
    }} />
  );
  expect(readEvent(container).eventStatus).toBe('https://schema.org/EventPostponed');
});

test.each([
  null,
  { ...nextMatch, match_id: null },
  { ...nextMatch, date: null },
  { ...nextMatch, opponent_name: '' },
  { ...nextMatch, home_game: undefined },
])('retains the page/team nodes without fabricating an incomplete event', (match) => {
  const { container } = render(<SportsTeamStructuredData team={team} nextMatch={match} />);
  expect(readGraph(container)['@graph']).toHaveLength(2);
  expect(readGraph(container)['@graph'][1]).not.toHaveProperty('mentions');
});

test('warns and omits an invalid kickoff instead of throwing or using the current time', () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  const { container } = render(
    <SportsTeamStructuredData team={team} nextMatch={{ ...nextMatch, date: 'not-a-date' }} />
  );
  expect(readEvent(container)).toBeUndefined();
  expect(warning).toHaveBeenCalledWith('Invalid team hub structured data kickoff:', 'not-a-date');
  warning.mockRestore();
});

test('does not fabricate an opponent ID when its slug is missing', () => {
  const { container } = render(
    <SportsTeamStructuredData team={team} nextMatch={{ ...nextMatch, opponent_slug: null }} />
  );
  expect(readEvent(container).awayTeam).toEqual({ '@type': 'SportsTeam', name: 'Norwich' });
});

test('removes an old event when there is no longer a next match', () => {
  const { container, rerender } = render(<SportsTeamStructuredData team={team} nextMatch={nextMatch} />);
  expect(readEvent(container)).toBeDefined();
  rerender(<SportsTeamStructuredData team={team} nextMatch={null} />);
  expect(readEvent(container)).toBeUndefined();
  expect(container.querySelectorAll('script')).toHaveLength(1);
});
