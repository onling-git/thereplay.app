import { fireEvent, render, screen } from '@testing-library/react';
import GuestHome from './GuestHome';
import { useAuth } from '../contexts/AuthContext';
import { getOpponentScout } from '../api';

jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api', () => ({ getOpponentScout: jest.fn(), getNewsForTeam: jest.fn() }));
jest.mock('../components/TeamSearch/TeamSearch', () => () => <input aria-label="Search teams" />);
jest.mock('../components/Auth/AuthModal', () => ({ isOpen, onClose, initialMode }) => isOpen ? (
  <div role="dialog" aria-label={initialMode}><button onClick={onClose}>Close login</button></div>
) : null);

beforeEach(() => {
  jest.clearAllMocks();
  useAuth.mockReturnValue({ isAuthenticated: false });
});

test('keeps Your Club generic throughout the static Premier League hub', () => {
  render(<GuestHome />);
  expect(screen.getByRole('heading', { name: 'Your Club' })).toBeInTheDocument();
  expect(screen.getByText(/Static preview/)).toBeInTheDocument();
  ['Next Match', 'Recent Matches', 'Upcoming Matches', 'Fan Reactions', 'Latest News', 'Community', 'Season Statistics'].forEach((name) => {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  });
  expect(screen.queryByText(/Arsenal|Emirates|North Bank|Clock End|Example|Riverside|Northbridge/)).not.toBeInTheDocument();
  expect(screen.getByRole('row', { name: /Your Club/ })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Your Club leave it late to edge Newcastle at home' })).toBeInTheDocument();
  screen.getAllByRole('img').forEach((image) => expect(image.getAttribute('src')).not.toContain('NaN'));
  expect(getOpponentScout).not.toHaveBeenCalled();
});

test('uses real opponents and badges with the generic club badge in local preview cards', () => {
  render(<GuestHome />);
  expect(screen.getAllByRole('button', { name: 'Your Club' })).toHaveLength(7);
  expect(screen.getByRole('button', { name: 'Chelsea' })).toBeInTheDocument();
  screen.getAllByRole('img', { name: 'Chelsea' }).forEach((image) => expect(image).toHaveAttribute('src', 'https://cdn.sportmonks.com/images/soccer/teams/18/18.png'));
  screen.getAllByRole('img', { name: 'Your Club' }).forEach((image) => expect(image.getAttribute('src')).toContain('football-icon.svg'));
  expect(screen.getAllByRole('button', { name: 'Live updates' })).toHaveLength(7);
  expect(screen.getAllByRole('article')).toHaveLength(6);
});

test('uses guest-only classes instead of shared dashboard classes', () => {
  render(<GuestHome />);
  expect(screen.getByRole('heading', { name: 'Your Club' })).toHaveClass('gh-title');
  expect(screen.getByRole('row', { name: /Your Club/ })).toHaveClass('gh-current-team');
  expect(screen.getByRole('button', { name: 'Full Table →' })).toHaveClass('gh-report-links');
  expect(screen.getByRole('button', { name: 'Full Table →' })).not.toHaveClass('card-link');
  screen.getAllByRole('article').forEach((article) => {
    expect(article).not.toHaveClass('tweet-card');
    expect(article).not.toHaveClass('community-discussion-card');
  });
});

test('every preview action opens login instead of navigating or opening static data modals', () => {
  render(<GuestHome />);
  const actions = [...screen.getAllByRole('button'), ...screen.getAllByRole('link')];
  expect(actions.length).toBeGreaterThan(20);
  actions.forEach((action) => {
    fireEvent.click(action);
    expect(screen.getByRole('dialog', { name: 'login' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'All Team Statistics' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close login' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

test('keeps the generic preview login-gated for visitors without a selected club', () => {
  useAuth.mockReturnValue({ isAuthenticated: true });
  render(<GuestHome />);
  fireEvent.click(screen.getByRole('button', { name: 'Choose your club' }));
  expect(screen.getByRole('dialog', { name: 'login' })).toBeInTheDocument();
});
