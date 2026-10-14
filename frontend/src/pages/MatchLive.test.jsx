import { act, render, waitFor } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import useSSE from '../hooks/useSSE';
import { getMatch, getTeamSnapshot, getMatchSchema } from '../api';
import MatchLive from './MatchLive';

jest.mock('react-router-dom', () => ({ useParams: jest.fn() }));
jest.mock('../hooks/useSSE', () => jest.fn());
jest.mock('../api', () => ({
  sseMatchUrl: jest.fn(() => 'https://api.example.com/stream'),
  getMatch: jest.fn(),
  getTeamSnapshot: jest.fn(),
  getMatchSchema: jest.fn(),
  getLeagueStandings: jest.fn(),
}));
jest.mock('../components/AdSense', () => ({ AdSenseAd: () => null, PremiumBanner: () => null }));
jest.mock('../components/Breadcrumbs/Breadcrumbs', () => () => null);

const match = {
  match_id: 19729063,
  teams: {
    home: { team_slug: 'southampton', team_name: 'Southampton' },
    away: { team_slug: 'portsmouth', team_name: 'Portsmouth' },
  },
  score: { home: 0, away: 0 },
  match_info: { starting_at: '2026-10-17T19:00:00Z' },
  events: [], comments: [], match_status: { short_name: 'NS' },
};
const schema = (id = '19729063', headline = 'Southampton vs Portsmouth') => ({
  matchUrl: `https://thereplay.app/southampton/match/${id}`,
  graph: { '@context': 'https://schema.org', '@graph': [
    { '@type': 'SportsEvent', '@id': `https://thereplay.app/southampton/match/${id}#event`, name: headline },
  ] },
});
const script = () => document.getElementById('live-match-structured-data');

beforeEach(() => {
  useParams.mockReturnValue({ teamSlug: 'southampton', matchId: '19729063' });
  useSSE.mockReturnValue({ data: null, status: 'open' });
  getMatch.mockResolvedValue(match);
  getTeamSnapshot.mockResolvedValue({});
  getMatchSchema.mockResolvedValue(schema());
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('renders the backend canonical graph and refreshes it when SSE changes the match', async () => {
  const { rerender, unmount } = render(<MatchLive />);
  await waitFor(() => expect(script()).not.toBeNull());
  expect(JSON.parse(script().textContent)).toEqual(schema().graph);
  const updatedSchema = schema('19729063', 'Updated match');
  getMatchSchema.mockResolvedValue(updatedSchema);
  useSSE.mockReturnValue({ data: { match_id: 19729063, match_status: { short_name: 'FT' } }, status: 'complete' });
  rerender(<MatchLive />);
  await waitFor(() => expect(JSON.parse(script().textContent)).toEqual(updatedSchema.graph));
  unmount();
  expect(script()).toBeNull();
});

test('ignores a late schema response when navigating to a different match', async () => {
  let resolveOld;
  getMatchSchema.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  const { rerender } = render(<MatchLive />);
  await waitFor(() => expect(getMatchSchema).toHaveBeenCalled());
  useParams.mockReturnValue({ teamSlug: 'southampton', matchId: '19729064' });
  getMatch.mockResolvedValue({ ...match, match_id: 19729064 });
  getMatchSchema.mockResolvedValue(schema('19729064'));
  rerender(<MatchLive />);
  await waitFor(() => expect(script()).not.toBeNull());
  await act(async () => { resolveOld(schema()); });
  expect(JSON.parse(script().textContent)['@graph'][0]['@id']).toBe(
    'https://thereplay.app/southampton/match/19729064#event'
  );
});

test('a schema service failure removes obsolete structured data and is logged', async () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { rerender } = render(<MatchLive />);
  await waitFor(() => expect(script()).not.toBeNull());
  getMatchSchema.mockRejectedValue(new Error('Schema unavailable'));
  useSSE.mockReturnValue({ data: { match_id: 19729063, match_status: { short_name: 'POSTP' } }, status: 'open' });
  rerender(<MatchLive />);
  await waitFor(() => expect(script()).toBeNull());
  expect(error).toHaveBeenCalledWith('Failed to fetch match schema:', expect.any(Error));
});
