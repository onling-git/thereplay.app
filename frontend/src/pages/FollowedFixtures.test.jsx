import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useAuth } from '../contexts/AuthContext';
import { getTeamPreferences } from '../api/auth';
import { checkFavoriteStatus, getFavoriteMatches, toggleFavoriteMatch } from '../api/favorites';
import FollowedFixtures from './FollowedFixtures';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api/auth', () => ({ getTeamPreferences: jest.fn() }));
jest.mock('../api/favorites', () => ({
  getFavoriteMatches: jest.fn(),
  checkFavoriteStatus: jest.fn(),
  toggleFavoriteMatch: jest.fn(),
}));
jest.mock('../components/AdSense', () => ({ AdSenseAd: () => null, PremiumBanner: () => null }));
jest.mock('../components/Auth/AuthModal', () => () => null);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  jest.setSystemTime(new Date('2026-10-15T12:00:00Z'));
});
afterEach(() => jest.useRealTimers());

  test('hides team-derived stars and shows an active removable star for individually saved fixtures', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
    getTeamPreferences.mockResolvedValue({
      data: { team_preferences: { favourite_team: 1, followed_teams: [2] } },
    });
    const fixture = (id, source) => ({
      _id: String(id),
      match_id: id,
      source,
      match_info: {
        starting_at: '2026-10-15T15:00:00Z',
        home_team: { team_name: `Home ${id}` },
        away_team: { team_name: `Away ${id}` },
      },
    });
    getFavoriteMatches.mockResolvedValue({
      data: { favorites: [
        fixture(1, 'auto_favorite_team'),
        fixture(2, 'auto_followed_team'),
        fixture(3, 'manual'),
      ] },
    });
    toggleFavoriteMatch.mockResolvedValue({ success: true, action: 'removed' });
    const originalFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ matches: [] }),
    });
    const scroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      render(<FollowedFixtures />);
      await screen.findByText('Home 3');
      await waitFor(() => expect(screen.queryByText('Loading your followed fixtures...')).not.toBeInTheDocument());
      const stars = screen.getAllByRole('button', { name: 'Remove from favourites' });
      expect(stars).toHaveLength(1);
      expect(stars[0]).toHaveClass('favorited');
      expect(stars[0]).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('button', { name: 'Add to favourites' })).not.toBeInTheDocument();
      expect(checkFavoriteStatus).not.toHaveBeenCalled();

      fireEvent.click(stars[0]);
      await waitFor(() => expect(screen.queryByText('Home 3')).not.toBeInTheDocument());
      expect(toggleFavoriteMatch).toHaveBeenCalledWith(3);
      expect(screen.getByText('Home 1')).toBeInTheDocument();
      expect(screen.getByText('Home 2')).toBeInTheDocument();
    } finally {
      global.fetch = originalFetch;
      scroll.mockRestore();
      log.mockRestore();
    }
  });
  test('groups fixtures chronologically by month and year with independently collapsible cards', async () => {
    useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
    getTeamPreferences.mockResolvedValue({ data: { team_preferences: {} } });
    const fixture = (id, date) => ({
      _id: String(id), match_id: id, source: 'auto_followed_team',
      teams: {
        home: { team_name: `Home ${id}`, team_slug: `home-${id}`, logo: '/home-badge.png', has_report: id !== 5 },
        away: { team_name: `Away ${id}`, team_slug: `away-${id}`, logo: '/away-badge.png', has_report: id === 5 },
      },
      score: { home: 2, away: 0 },
      match_status: { short_name: 'FT' },
      match_info: {
        starting_at: date,
        home_team: { team_name: `Home ${id}`, team_slug: `home-${id}` },
        away_team: { team_name: `Away ${id}` },
        league: { name: 'Not a grouping heading' },
      },
    });
    getFavoriteMatches.mockResolvedValue({ data: { favorites: [
      fixture(4, '2027-10-10T15:00:00Z'),
      fixture(2, '2026-10-20T15:00:00Z'),
      fixture(3, '2026-11-10T15:00:00Z'),
      fixture(1, '2026-10-10T15:00:00Z'),
      fixture(5, '2026-09-20T15:00:00Z'),
    ] } });
    const scroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});

    try {
      render(<FollowedFixtures />);
      const october = await screen.findByRole('region', { name: 'October 2026' });
      expect(screen.getAllByRole('region').map((region) => region.getAttribute('aria-label')))
        .toEqual(['September 2026', 'October 2026', 'November 2026', 'October 2027']);
      expect(within(october).getAllByRole('article').map((article) =>
        within(article).getByRole('link', { name: /Home/ }).textContent)).toEqual(['Home 1', 'Home 2']);
      expect(within(october).getByText('2 fixtures')).toBeInTheDocument();
      expect(within(october).getByRole('link', { name: 'Home 1' }))
        .toHaveAttribute('href', '/home-1/match/1/live');
      expect(screen.queryByText('Not a grouping heading')).not.toBeInTheDocument();
      expect(october).toHaveClass('followed-fixtures-month');
      expect(within(october).getAllByRole('article')[0]).toHaveClass('followed-fixtures-match');
      expect(within(october).getAllByRole('article')[0]).not.toHaveClass('fixture-card');
      expect(within(october).getAllByAltText('')[0]).toHaveAttribute('src', '/home-badge.png');
      const firstMatch = within(october).getAllByRole('article')[0];
      expect(within(firstMatch).getByText('2')).toHaveClass('followed-fixtures-team-score');
      expect(within(firstMatch).getByText('0')).toHaveClass('followed-fixtures-team-score');
      expect(within(firstMatch).getByRole('link', { name: 'Match report' }))
        .toHaveAttribute('href', '/home-1/match/1/report');
      const september = screen.getByRole('region', { name: 'September 2026' });
      expect(within(september).getByRole('button')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Home 5')).not.toBeInTheDocument();
      fireEvent.click(within(september).getByRole('button'));
      expect(screen.getByText('Home 5')).toBeInTheDocument();
      expect(within(september).getByRole('link', { name: 'Match report' }))
        .toHaveAttribute('href', '/away-5/match/5/report');
      expect(getFavoriteMatches).toHaveBeenCalledWith({ currentSeason: true });

      const toggle = within(october).getByRole('button');
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByText('Home 1')).not.toBeInTheDocument();
      expect(screen.getByText('Home 3')).toBeInTheDocument();
      fireEvent.click(toggle);
      expect(toggle).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByText('Home 1')).toBeInTheDocument();
    } finally {
      scroll.mockRestore();
      log.mockRestore();
    }
  });
test('shows all dates by default and allows selecting and clearing a date', async () => {
  useAuth.mockReturnValue({ isAuthenticated: true, loading: false });
  getTeamPreferences.mockResolvedValue({
    data: { team_preferences: { followed_teams: [1] } },
  });
  getFavoriteMatches.mockResolvedValue({ data: { favorites: [] } });
  const originalFetch = global.fetch;
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ matches: [] }),
  });
  global.fetch = fetchMock;
  const scroll = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
  const log = jest.spyOn(console, 'log').mockImplementation(() => {});

  try {
    render(<FollowedFixtures />);
    const dateInput = screen.getByDisplayValue('');
    expect(dateInput).toHaveAttribute('type', 'date');
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(fetchMock.mock.calls.every(([url]) => {
      const params = new URL(url).searchParams;
      return !params.has('date') && params.get('current_season') === 'true';
    })).toBe(true);
    await screen.findByText('No Fixtures Found');
    expect(screen.queryByText(/fixtures on this day/)).not.toBeInTheDocument();

    fireEvent.change(dateInput, { target: { value: '2026-10-15' } });
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('&date=2026-10-15'),
    ));
    await screen.findByText(/fixtures on this day/);

    fireEvent.click(screen.getByRole('button', { name: 'Show All Dates' }));
    await waitFor(() => {
      const url = fetchMock.mock.calls[fetchMock.mock.calls.length - 1][0];
      expect(new URL(url).searchParams.has('date')).toBe(false);
    });
    expect(dateInput).toHaveValue('');
    await screen.findByText('No Fixtures Found');
  } finally {
    global.fetch = originalFetch;
    scroll.mockRestore();
    log.mockRestore();
  }
});
