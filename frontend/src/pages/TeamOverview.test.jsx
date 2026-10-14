import { act, render, screen, waitFor } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import {
  getLastMatchForTeam,
  getTeamStandings,
  getTeamCompetitions,
  getTeamFixtures,
  getTeamSeasonStatistics,
} from '../api';
import TeamOverview from './TeamOverview';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}));
jest.mock('../api', () => ({
  getLastMatchForTeam: jest.fn(),
  getTeamStandings: jest.fn(),
  getTeamCompetitions: jest.fn(),
  getTeamFixtures: jest.fn(),
  getTeamSeasonStatistics: jest.fn(),
}));
jest.mock('../api/base', () => ({ API_BASE: 'https://api.example.com' }));
jest.mock('../components/MatchInfoCard/MatchInfoCard', () => () => null);
jest.mock('../components/FixturesCard/FixturesCard.jsx', () => () => null);
jest.mock('../components/StandingsPositionCard/StandingsPositionCard', () => () => null);
jest.mock('../components/CompetitionsCard/CompetitionsCard', () => () => null);
jest.mock('../components/StandingsModal/StandingsModal', () => () => null);
jest.mock('../components/AdSense', () => ({
  AdSenseAd: () => null,
  PremiumBanner: () => null,
}));
jest.mock('../components/NewsCard/NewsCard', () => () => null);
jest.mock('../components/TeamTweetsCard/TeamTweetsCard', () => () => null);
jest.mock('../components/Breadcrumbs/Breadcrumbs', () => () => null);
jest.mock('../components/TeamHubCommunity', () => ({ TeamHubCommunitySection: () => null }));
jest.mock('../components/TeamSeasonStatistics/TeamSeasonStatistics', () => () => null);
jest.mock('../components/TeamSelection/TeamPreferenceButtons', () => () => null);

const originalFetch = global.fetch;
const responseFor = (team) => ({ ok: true, json: async () => team });
const schemaScript = () => document.querySelector('script[type="application/ld+json"]');

beforeEach(() => {
  getLastMatchForTeam.mockResolvedValue(null);
  getTeamStandings.mockResolvedValue({ data: [] });
  getTeamCompetitions.mockResolvedValue({ competitions: [] });
  getTeamFixtures.mockResolvedValue({ recent: [], upcoming: [] });
  getTeamSeasonStatistics.mockResolvedValue({ statistics: [] });
  useParams.mockReturnValue({ teamSlug: 'southampton' });
  global.fetch = jest.fn().mockResolvedValue(responseFor({ tweets: [] }));
  jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  jest.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test('only renders schema once the team loads and removes it when leaving', async () => {
  let resolveTeam;
  const pendingTeam = new Promise((resolve) => { resolveTeam = resolve; });
  global.fetch.mockImplementation((url) => url.includes('/api/teams/')
    ? pendingTeam
    : Promise.resolve(responseFor({ tweets: [] })));

  const { unmount } = render(<TeamOverview />);
  expect(schemaScript()).toBeNull();
  await act(async () => {
    resolveTeam(responseFor({
      id: 65, slug: 'southampton', name: 'Southampton',
      venue: { id: 65, slug: 'st-marys-stadium-65', name: "St Mary's Stadium" },
    }));
  });

  expect(JSON.parse(schemaScript().textContent)['@graph'][0].name).toBe('Southampton');
  expect(screen.getByRole('heading', { name: 'Southampton' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'News' })).toHaveAttribute('href', '/southampton/news');
  expect(screen.getByRole('link', { name: 'View all →' })).toHaveAttribute('href', '/southampton/news');
  expect(screen.getByText("St Mary's Stadium")).toBeInTheDocument();
  expect(JSON.parse(schemaScript().textContent)['@graph'][0].location['@id']).toBe(
    'https://thereplay.app/venues/st-marys-stadium-65#place'
  );
  unmount();
  expect(schemaScript()).toBeNull();
});

test('ignores a previous team response that finishes after navigation', async () => {
  let resolveSouthampton;
  let resolveArsenal;
  const southampton = new Promise((resolve) => { resolveSouthampton = resolve; });
  const arsenal = new Promise((resolve) => { resolveArsenal = resolve; });
  global.fetch.mockImplementation((url) => {
    if (url.endsWith('/api/teams/southampton')) return southampton;
    if (url.endsWith('/api/teams/arsenal')) return arsenal;
    return Promise.resolve(responseFor({ tweets: [] }));
  });

  const { rerender } = render(<TeamOverview />);
  useParams.mockReturnValue({ teamSlug: 'arsenal' });
  rerender(<TeamOverview />);
  expect(schemaScript()).toBeNull();

  await act(async () => {
    resolveArsenal(responseFor({ id: 19, slug: 'arsenal', name: 'Arsenal' }));
  });
  await act(async () => {
    resolveSouthampton(responseFor({ id: 65, slug: 'southampton', name: 'Southampton' }));
  });

  expect(JSON.parse(schemaScript().textContent)['@graph'][0]['@id']).toBe('https://thereplay.app/arsenal/');
  expect(screen.getByRole('heading', { name: 'Arsenal' })).toBeInTheDocument();
  expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
});

test('removes the previous schema while loading a team that returns an error', async () => {
  getTeamStandings.mockResolvedValue({
    data: [{
      season_id: 1,
      league_id: 1,
      league_name: 'League',
      table: [{ participant_id: 65, position: 1 }],
    }],
  });

  global.fetch.mockImplementation((url) => Promise.resolve(
    url.endsWith('/api/teams/southampton')
      ? responseFor({ id: 65, slug: 'southampton', name: 'Southampton' })
      : responseFor({ tweets: [] })
  ));
  const { rerender } = render(<TeamOverview />);
  await waitFor(() => expect(schemaScript()).not.toBeNull());

  global.fetch.mockImplementation((url) => Promise.resolve(
    url.endsWith('/api/teams/unknown')
      ? { ok: false, status: 404 }
      : responseFor({ tweets: [] })
  ));
  useParams.mockReturnValue({ teamSlug: 'unknown' });
  rerender(<TeamOverview />);
  expect(schemaScript()).toBeNull();
  expect(await screen.findByText('Error: HTTP 404')).toBeInTheDocument();
  expect(schemaScript()).toBeNull();
});

test('uses the card snapshot then updates the event with resolved match details', async () => {
    let resolveMatch;
    const pendingMatch = new Promise((resolve) => { resolveMatch = resolve; });
    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/api/teams/southampton')) return Promise.resolve(responseFor({
        id: 65, slug: 'southampton', name: 'Southampton', next_match: 19729071,
        next_match_info: {
          match_id: 19729071, date: '2026-10-24T14:00:00Z', home_game: true,
          opponent_name: 'Norwich', opponent_slug: 'norwich', status: 'upcoming',
          venue: { id: 65, slug: 'st-marys-stadium-65', name: "St Mary's Stadium" },
        },
      }));
      if (url.endsWith('/api/matches/19729071')) return pendingMatch;
      return Promise.resolve(responseFor({ tweets: [] }));
    });
    render(<TeamOverview />);
    const event = () => JSON.parse(schemaScript().textContent)['@graph']
      .find((node) => node['@type'] === 'SportsEvent');
    await waitFor(() => expect(event()?.name).toBe('Southampton vs Norwich'));
    expect(event().eventStatus).toBe('https://schema.org/EventScheduled');
    expect(event().location['@id']).toBe('https://thereplay.app/venues/st-marys-stadium-65#place');
    await act(async () => {
      resolveMatch(responseFor({
        match_id: 19729071, date: '2026-10-24T16:00:00Z',
        teams: {
          home: { team_name: 'Southampton', team_slug: 'southampton' },
          away: { team_name: 'Norwich', team_slug: 'norwich' },
        },
        match_status: { developer_name: 'POSTP' },
      }));
    });
    expect(event().startDate).toBe('2026-10-24T16:00:00.000Z');
    expect(event().eventStatus).toBe('https://schema.org/EventPostponed');
  });

test('an old match request cannot attach an event to a newly loaded team', async () => {
    let resolveOldMatch;
    const pendingMatch = new Promise((resolve) => { resolveOldMatch = resolve; });
    global.fetch.mockImplementation((url) => {
      if (url.endsWith('/api/teams/southampton')) return Promise.resolve(responseFor({
        id: 65, slug: 'southampton', name: 'Southampton', next_match: 19729071,
        next_match_info: {
          match_id: 19729071, date: '2026-10-24T14:00:00Z', home_game: true,
          opponent_name: 'Norwich', opponent_slug: 'norwich',
        },
      }));
      if (url.endsWith('/api/teams/arsenal')) return Promise.resolve(responseFor({
        id: 19, slug: 'arsenal', name: 'Arsenal',
      }));
      if (url.endsWith('/api/matches/19729071')) return pendingMatch;
      return Promise.resolve(responseFor({ tweets: [] }));
    });
    const { rerender } = render(<TeamOverview />);
    await screen.findByRole('heading', { name: 'Southampton' });
    useParams.mockReturnValue({ teamSlug: 'arsenal' });
    rerender(<TeamOverview />);
    await screen.findByRole('heading', { name: 'Arsenal' });
    await act(async () => {
      resolveOldMatch(responseFor({
        match_id: 19729071, date: '2026-10-24T14:00:00Z',
        opponent_name: 'Norwich', opponent_slug: 'norwich', home_game: true,
      }));
    });
    const graph = JSON.parse(schemaScript().textContent)['@graph'];
    expect(graph[0].name).toBe('Arsenal');
    expect(graph.some((node) => node['@type'] === 'SportsEvent')).toBe(false);
  });
