import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { getTeams } from '../../api';
import TeamSearch from './TeamSearch';

jest.mock('react-router-dom', () => ({ useNavigate: jest.fn() }));
jest.mock('../../api', () => ({ getTeams: jest.fn() }));

const navigate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  useNavigate.mockReturnValue(navigate);
  getTeams.mockResolvedValue({ teams: [{ name: 'Arsenal', slug: 'arsenal' }] });
});

test('opens from the search icon, focuses the input, and toggles closed', async () => {
  await act(async () => { render(<TeamSearch />); });
  const toggle = screen.getByRole('button', { name: 'Search teams' });
  expect(toggle).toHaveAttribute('aria-expanded', 'false');

  fireEvent.click(toggle);
  expect(screen.getByRole('textbox', { name: 'Search teams' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Close team search' })).toHaveAttribute('aria-expanded', 'true');

  fireEvent.click(screen.getByRole('button', { name: 'Close team search' }));
  expect(screen.getByRole('button', { name: 'Search teams' })).toHaveAttribute('aria-expanded', 'false');
});

test('Escape clears the query, closes search, and restores icon focus', async () => {
  await act(async () => { render(<TeamSearch />); });
  fireEvent.click(screen.getByRole('button', { name: 'Search teams' }));
  const input = screen.getByRole('textbox', { name: 'Search teams' });
  fireEvent.change(input, { target: { value: 'Arsenal' } });
  fireEvent.keyDown(input, { key: 'Escape' });

  expect(input).toHaveValue('');
  expect(screen.getByRole('button', { name: 'Search teams' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Search teams' })).toHaveAttribute('aria-expanded', 'false');
});

test('outside clicks collapse search on desktop too', async () => {
  await act(async () => { render(<TeamSearch />); });
  fireEvent.click(screen.getByRole('button', { name: 'Search teams' }));
  fireEvent.mouseDown(document.body);

  expect(screen.getByRole('button', { name: 'Search teams' })).toHaveAttribute('aria-expanded', 'false');
});

test('team suggestions still navigate and close the search', async () => {
  render(<TeamSearch />);
  await waitFor(() => expect(getTeams).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: 'Search teams' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'Search teams' }), { target: { value: 'Ars' } });
  fireEvent.click(await screen.findByText('Arsenal'));

  expect(navigate).toHaveBeenCalledWith('/arsenal');
  expect(screen.getByRole('button', { name: 'Search teams' })).toHaveAttribute('aria-expanded', 'false');
});