import { fireEvent, render, screen } from '@testing-library/react';
import GuestHome from './GuestHome';
import { useAuth } from '../contexts/AuthContext';

jest.mock('react-router-dom', () => ({ Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a> }));
jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../components/TeamSearch/TeamSearch', () => () => <input aria-label="Search teams" />);

beforeEach(() => useAuth.mockReturnValue({ isAuthenticated: false }));

test('renders labelled static hub sections without fictional navigation or data requests', () => {
  const fetchSpy = jest.spyOn(global, 'fetch');
  render(<GuestHome />);
  expect(screen.getByRole('heading', { name: 'Your Favourite FC' })).toBeInTheDocument();
  expect(screen.getByText(/All fixtures, results and stories below are made up/)).toBeInTheDocument();
  ['Next Match', 'Recent Matches', 'Upcoming Matches', 'Fan Reactions', 'Latest News', 'Community'].forEach((name) => {
    expect(screen.getByRole('heading', { name })).toBeInTheDocument();
  });
  expect(fetchSpy).not.toHaveBeenCalled();
  screen.getAllByRole('link').forEach((link) => expect(link.getAttribute('href')).not.toMatch(/^\/example-|\/match\//));
  fetchSpy.mockRestore();
});

test('opens and closes the example table without navigation', () => {
  render(<GuestHome />);
  fireEvent.click(screen.getByRole('button', { name: 'Full table' }));
  expect(screen.getByRole('dialog', { name: 'Example league table' })).toBeInTheDocument();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Full table' })).toHaveFocus();
});

test('opens the static season statistics', () => {
  render(<GuestHome />);
  fireEvent.click(screen.getByRole('button', { name: /View all/ }));
  expect(screen.getByRole('dialog', { name: 'All Team Statistics' })).toBeInTheDocument();
  expect(screen.getByText('Shots on target')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Close statistics' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('offers preference selection for signed-in visitors without a favourite', () => {
  useAuth.mockReturnValue({ isAuthenticated: true });
  render(<GuestHome />);
  expect(screen.getByRole('link', { name: 'Choose your favourite' })).toHaveAttribute('href', '/account/team-preferences');
});