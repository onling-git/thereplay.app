import { render, screen } from '@testing-library/react';
import { useAuth } from '../contexts/AuthContext';
import { useFavoriteTeam } from '../hooks/useFavoriteTeam';
import HomeRoute from './HomeRoute';

jest.mock('react-router-dom', () => ({
  Navigate: ({ to, replace }) => <div data-testid="redirect" data-replace={String(replace)}>{to}</div>,
}));
jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../hooks/useFavoriteTeam', () => ({ useFavoriteTeam: jest.fn() }));
jest.mock('./GuestHome', () => () => <h1>Guest homepage</h1>);

beforeEach(() => {
  useAuth.mockReturnValue({ user: null, isAuthenticated: false, loading: false });
  useFavoriteTeam.mockReturnValue({ favoriteTeam: null, loading: false, error: null });
});

test('shows the guest homepage without redirecting', () => {
  render(<HomeRoute />);
  expect(screen.getByRole('heading', { name: 'Guest homepage' })).toBeInTheDocument();
  expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
});

test('waits for authentication before showing a homepage', () => {
  useAuth.mockReturnValue({ loading: true });
  render(<HomeRoute />);
  expect(screen.getByRole('status')).toBeInTheDocument();
  expect(screen.queryByRole('heading')).not.toBeInTheDocument();
});

test('waits for the favourite lookup, including its initial render', () => {
  useAuth.mockReturnValue({ user: { favourite_team: 1 }, isAuthenticated: true, loading: false });
  render(<HomeRoute />);
  expect(screen.getByRole('status')).toBeInTheDocument();
});

test('redirects a signed-in user to their favourite with history replacement', () => {
  useAuth.mockReturnValue({ user: { favourite_team: 1 }, isAuthenticated: true, loading: false });
  useFavoriteTeam.mockReturnValue({ favoriteTeam: { slug: 'arsenal' }, loading: false });
  render(<HomeRoute />);
  expect(screen.getByTestId('redirect')).toHaveTextContent('/arsenal');
  expect(screen.getByTestId('redirect')).toHaveAttribute('data-replace', 'true');
});

test.each([null, 1])('falls back to the homepage for no favourite or a failed lookup: %s', (favouriteId) => {
  useAuth.mockReturnValue({ user: { favourite_team: favouriteId }, isAuthenticated: true, loading: false });
  useFavoriteTeam.mockReturnValue({ favoriteTeam: null, loading: false, error: favouriteId ? 'Unavailable' : null });
  render(<HomeRoute />);
  expect(screen.getByRole('heading')).toBeInTheDocument();
});