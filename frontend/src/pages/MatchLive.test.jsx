import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import useSSE from '../hooks/useSSE';
import { getMatch, getTeamSnapshot, getMatchSchema } from '../api';
import MatchLive from './MatchLive';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));
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

test('uses the report score card while retaining live scores, status and team events', async () => {
  getMatch.mockResolvedValue({
    ...match,
    score: { home: 1, away: 0 },
    events: [{ id: 1, type: 'GOAL', player_name: 'James Bree', minute: 20, team: 'home' }],
    match_status: { short_name: 'LIVE', minute: 25 },
  });
  const { rerender } = render(<MatchLive />);
  const card = await screen.findByRole('region', { name: 'Match score' });
  expect(card).toHaveClass('card', 'match-report-card');
  expect(within(card).getByText('Southampton')).toHaveClass('match-live-team-name');
  expect(within(card).getByText('Portsmouth')).toHaveClass('match-live-team-name');
  expect(within(card).getByText('1:0')).toHaveClass('match-report-score');
  expect(within(card).getByText("LIVE 25'")).toBeInTheDocument();
  expect(within(card).getByText('Sat, 17 Oct 2026')).toBeInTheDocument();
  expect(within(card).getByText('James Bree')).toBeInTheDocument();
  expect(within(card).getByRole('link', { name: /Back to team HUB/ })).toHaveAttribute('href', '/southampton');

  useSSE.mockReturnValue({
    data: { match_id: match.match_id, score: { home: 2, away: 0 }, match_status: { short_name: 'FT' } },
    status: 'complete',
  });
  rerender(<MatchLive />);
  expect(await within(card).findByText('2:0')).toBeInTheDocument();
  expect(within(card).getByText('FT')).toBeInTheDocument();
  expect(within(card).queryByText('1:0')).not.toBeInTheDocument();
});

test('merges goal commentary and highlights second-yellow dismissals across tabs', async () => {
  getMatch.mockResolvedValue({
    ...match,
    events: [
      { id: 1, minute: 20, type: 'GOAL', player: 'James Bree', player_name: 'James Bree', team: 'home' },
      { id: 3, minute: 32, type: 'YELLOWCARD', player: 'Cameron Bragg', player_name: 'Cameron Bragg', team: 'home' },
      { id: 2, minute: 44, type: 'YELLOWREDCARD', player: 'Cameron Bragg', player_name: 'Cameron Bragg', team: 'home' },
    ],
    comments: [
      { minute: 20, order: 8, comment: 'James Bree takes a left-footed shot and scores.', is_important: true },
      { minute: 20, order: 7, comment: 'Goal! James Bree scores to make it 1-0, assisted by Finn Azaz.', is_goal: true, is_important: true },
      { minute: 44, order: 14, comment: 'Cameron Bragg receives a second yellow card.', is_important: false },
    ],
  });
  render(<MatchLive />);
  await screen.findByText(/left-footed shot and scores/);
  const goalComments = screen.getAllByRole('listitem').filter((item) =>
    within(item).queryByText(/left-footed shot and scores/));
  expect(goalComments).toHaveLength(1);
  const goalComment = goalComments[0];
  expect(goalComment).toHaveClass('goal-comment');
  expect(goalComment).toHaveTextContent('left-footed shot and scores');
  expect(goalComment).toHaveTextContent('assisted by Finn Azaz');
  expect(goalComment).toHaveTextContent('GOAL!!!');
  const dismissalComment = screen.getAllByRole('listitem').find((item) =>
    within(item).queryByText(/Cameron Bragg receives a second yellow card/));
  expect(dismissalComment).toHaveClass('important-comment');
  expect(within(dismissalComment).getByText('RED CARD')).toBeInTheDocument();
  expect(dismissalComment).toHaveTextContent('Cameron Bragg receives a second yellow card.');
  expect(dismissalComment).not.toHaveTextContent('YELLOWREDCARD');
  expect(screen.getAllByText('Cameron Bragg')).toHaveLength(2);
  expect(screen.getByText('🟥')).toBeInTheDocument();
  fireEvent.click(screen.getByText('Key Events'));
  expect(screen.getAllByText('Cameron Bragg')).toHaveLength(3);
  expect(screen.getAllByText('🟥')).toHaveLength(2);
});

test('shows counted pitch badges, replaces yellow with red on live updates, and leaves the bench unchanged', async () => {
  const events = [
    { id: 1, type: 'GOAL', player_id: 1, related_player_id: 2, team: 'home', minute: 20 },
    { id: 2, type: 'GOAL', player_id: 1, related_player_id: 2, team: 'home' },
    { id: 3, type: 'YELLOWCARD', player_id: 1, team: 'home' },
    { id: 4, type: 'SUBSTITUTION', player_id: 3, player_name: 'Bench Player', related_player_id: 1, related_player_name: 'James Bree', team: 'home', minute: 90, extra_minute: 2 },
    { id: 5, type: 'GOAL', player_id: 3, team: 'home' },
    { id: 6, type: 'YELLOWCARD', player_id: 4, team: 'away' },
    { id: 8, type: 'OWNGOAL', player_id: 1, team: 'away' },
  ];
  getMatch.mockResolvedValue({
    ...match, events,
    player_ratings: [
      { player_id: 1, rating: 7.8 },
      { player_id: 3, rating: 6.5 },
    ],
    lineup: {
      home: [
        { player_id: 1, player_name: 'James Bree', formation_field: '2:1' },
        { player_id: 2, player_name: 'Finn Azaz', formation_field: '4:1' },
        { player_id: 3, player_name: 'Bench Player' },
      ],
      away: [{ player_id: 4, player_name: 'Away Player', formation_field: '2:1' }],
    },
  });
  const { rerender } = render(<MatchLive />);
  await screen.findByText('Commentary');
  fireEvent.click(screen.getByText('Lineups'));
  expect(screen.getAllByRole('img', { name: '2 goals' })).toHaveLength(1);
  expect(screen.getByRole('img', { name: '2 goals' })).toHaveTextContent('2');
  expect(screen.getAllByRole('img', { name: '2 assists' })).toHaveLength(1);
  expect(screen.getByRole('img', { name: '2 assists' })).toHaveTextContent('2');
  expect(screen.getByRole('img', { name: 'Yellow card' })).toBeInTheDocument();
  expect(within(screen.getByRole('img', { name: '2 goals' })).getByAltText('')).toHaveAttribute('src', 'goal.svg');
  expect(within(screen.getByRole('img', { name: '2 assists' })).getByAltText('')).toHaveAttribute('src', 'assist.svg');
  expect(within(screen.getByRole('img', { name: 'Yellow card' })).getByAltText('')).toHaveAttribute('src', 'yellow-card.svg');
  expect(screen.getByRole('img', { name: '1 own goal' })).toHaveClass('lineup-own-goal-badge');
  expect(within(screen.getByRole('img', { name: '1 own goal' })).getByAltText('')).toHaveAttribute('src', 'own-goal.svg');
  expect(screen.queryByRole('img', { name: '1 goal' })).not.toBeInTheDocument();
  expect(screen.getAllByText('↓')).toHaveLength(2);
  const squad = screen.getByRole('region', { name: 'Starting XI' });
  const bench = screen.getByRole('region', { name: 'Bench' });
  expect(within(squad).getAllByRole('listitem')).toHaveLength(2);
  expect(within(squad).getByText('James Bree')).toHaveClass('squad-player-full-name');
  expect(within(squad).getByLabelText('Player rating: 7.8')).toHaveClass('squad-player-match-rating');
  expect(within(bench).getByLabelText('Player rating: 6.5')).toHaveClass('bench-player-match-rating');
  expect(screen.getAllByLabelText(/Player rating:/)).toHaveLength(2);
  expect(screen.getAllByText('7.8')).toHaveLength(1);
  expect(screen.getAllByText('6.5')).toHaveLength(1);
  expect(within(bench).getAllByRole('listitem')).toHaveLength(1);
  expect(within(bench).getByText('Bench Player')).toHaveClass('bench-player-full-name');
  expect(within(bench).getByRole('listitem')).toHaveClass('bench-player');
  expect(within(bench).getByRole('listitem')).not.toHaveClass('formation-player');
  expect(within(bench).getByLabelText('Substituted on')).toHaveClass('bench-player-substitution');
  expect(within(bench).getByLabelText('Substituted on')).toHaveTextContent("90+2'for James Bree");
  expect(within(squad).getByLabelText('Substituted off')).toHaveTextContent("90+2'replaced by Bench Player");
  expect(within(squad).getAllByLabelText('Goal')[0]).toHaveTextContent("20'");
  expect(within(squad).getAllByLabelText('Assist')[0]).toHaveTextContent("20'");

  useSSE.mockReturnValue({
    data: { match_id: match.match_id, events: [...events, { id: 7, type: 'YELLOWREDCARD', player_id: 1, team: 'home' }] },
    status: 'open',
  });
  rerender(<MatchLive />);
  expect(await screen.findByRole('img', { name: 'Red card' })).toBeInTheDocument();
  expect(within(screen.getByRole('img', { name: 'Red card' })).getByAltText('')).toHaveAttribute('src', 'red-card.svg');
  expect(screen.queryByRole('img', { name: 'Yellow card' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Portsmouth' }));
  expect(within(screen.getByRole('region', { name: 'Starting XI' })).getByText('Away Player')).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Bench' })).toHaveTextContent('No bench players available');
  expect(screen.getByRole('img', { name: 'Yellow card' })).toBeInTheDocument();
  expect(screen.queryByRole('img', { name: 'Red card' })).not.toBeInTheDocument();
  expect(screen.queryByRole('img', { name: '2 goals' })).not.toBeInTheDocument();
});
