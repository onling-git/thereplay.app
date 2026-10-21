import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { getAllFixtures, getFixtureCountries, getFixtureLeagues, getFixtureTeams } from '../api';
import Fixtures from './Fixtures';

jest.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }) => <a href={to} {...props}>{children}</a>,
}));
jest.mock('../api', () => ({
  getAllFixtures: jest.fn(), getFixtureCountries: jest.fn(), getFixtureLeagues: jest.fn(), getFixtureTeams: jest.fn(),
}));
jest.mock('../components/Favorites/FavoriteButton', () => () => null);
jest.mock('../components/AdSense', () => ({ AdSenseAd: () => null, PremiumBanner: () => null }));

const country = (id, name, matchId = id) => ({
  id, name, leagues: [{ id, name: `${name} League`, fixtures: [{ match_id: matchId, teams: { home: {}, away: {} } }] }],
});

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
  getAllFixtures.mockResolvedValue({ fixtures: [], pagination: { total: 0, hasMore: false } });
  getFixtureCountries.mockResolvedValue([]);
  getFixtureLeagues.mockResolvedValue([]);
  getFixtureTeams.mockResolvedValue([]);
});
afterEach(() => jest.useRealTimers());

test.each([0, 23])('local Tuesday stays Tuesday at %s:30 and clicking Wednesday requests its actual date', async (hour) => {
  jest.setSystemTime(new Date(2026, 9, 20, hour, 30));
  const { container } = render(<Fixtures />);
  const today = await screen.findByText('TODAY');
  expect(today.closest('li')).toHaveTextContent('TUE');
  await waitFor(() => expect(getAllFixtures).toHaveBeenLastCalledWith(expect.objectContaining({ date: '2026-10-20' })));
  const tomorrow = Array.from(container.querySelectorAll('.fixture-day-strip li')).find(li => li.textContent.includes('21 Oct'));
  expect(tomorrow).toHaveTextContent('WED');
  await act(async () => fireEvent.click(tomorrow));
  await waitFor(() => expect(getAllFixtures).toHaveBeenLastCalledWith(expect.objectContaining({ date: '2026-10-21' })));
  expect(await screen.findByText(/scheduled for 2026-10-21/)).toBeInTheDocument();
});

test('sorts initial and paginated countries alphabetically without losing existing matches', async () => {
  jest.setSystemTime(new Date(2026, 9, 20, 12));
  const initial = [country(3, 'Spain'), country(1, 'England')];
  getAllFixtures.mockImplementation(async ({ offset }) => offset
    ? { fixtures: [country(2, 'France'), country(1, 'England', 4)], pagination: { total: 4, hasMore: false } }
    : { fixtures: initial, pagination: { total: 4, hasMore: true } });
  const { container } = render(<Fixtures />);
  await screen.findByText('Spain');
  const names = () => Array.from(container.querySelectorAll('.country-header h6')).map(node => node.textContent);
  expect(names()).toEqual(['England', 'Spain']);
  fireEvent.click(screen.getByRole('button', { name: /Load More/ }));
  await waitFor(() => expect(names()).toEqual(['England', 'France', 'Spain']));
  expect(screen.getByText(/Showing 4 of 4 football matches/)).toBeInTheDocument();
  expect(initial.map(item => item.name)).toEqual(['Spain', 'England']);
});
