import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import FooterNav from './FooterNav';

jest.mock('react-router-dom', () => {
  const { TextEncoder, TextDecoder } = require('util');
  Object.assign(global, { TextEncoder, TextDecoder });
  return jest.requireActual('react-router');
});

jest.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
jest.mock('../../hooks/useFavoriteTeam', () => ({ useFavoriteTeam: () => ({ favoriteTeam: null, loading: false }) }));

test.each(['/news', '/southampton/news', '/west-ham-united/news/'])(
  'highlights News at %s',
  path => {
    render(<MemoryRouter initialEntries={[path]}><FooterNav /></MemoryRouter>);
    expect(screen.getByRole('link', { name: 'News' })).toHaveClass('active');
    expect(screen.getByRole('link', { name: 'News' })).toHaveAttribute('href', '/news');
  }
);

test('does not highlight News on the team hub', () => {
  render(<MemoryRouter initialEntries={['/southampton']}><FooterNav /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'News' })).not.toHaveClass('active');
});
