import { render, screen } from '@testing-library/react';
import { useFavoriteTeam } from '../../hooks/useFavoriteTeam';
import Header from './Header';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));
jest.mock('../../hooks/useFavoriteTeam', () => ({ useFavoriteTeam: jest.fn() }));
jest.mock('../Auth/AuthButtons', () => () => null);
jest.mock('../TeamSearch/TeamSearch', () => () => null);

test('links My team to the current favourite team and follows preference changes', () => {
  useFavoriteTeam.mockReturnValue({ favoriteTeam: { slug: 'southampton' }, loading: false });
  const { rerender } = render(<Header />);
  expect(screen.getByRole('link', { name: 'My team' })).toHaveAttribute('href', '/southampton');

  useFavoriteTeam.mockReturnValue({ favoriteTeam: { slug: 'arsenal' }, loading: false });
  rerender(<Header />);
  expect(screen.getByRole('link', { name: 'My team' })).toHaveAttribute('href', '/arsenal');
});

test.each([
  { favoriteTeam: null, loading: false },
  { favoriteTeam: { slug: 'southampton' }, loading: true },
  { favoriteTeam: {}, loading: false },
])('hides My team when no favourite destination is available: %p', (state) => {
  useFavoriteTeam.mockReturnValue(state);
  render(<Header />);

  expect(screen.queryByRole('link', { name: 'My team' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'News' })).toHaveAttribute('href', '/news');
});