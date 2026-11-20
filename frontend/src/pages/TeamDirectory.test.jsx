import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import TeamDirectory from './TeamDirectory';
import { getTeamCoverage } from '../api';

jest.mock('../api', () => ({ getTeamCoverage: jest.fn() }));
jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>
}));

beforeEach(() => {
  getTeamCoverage.mockReset();
});

function renderDirectory() {
  return render(<TeamDirectory />);
}

test('links every covered team in alphabetical groups', async () => {
  getTeamCoverage.mockResolvedValue({ teams: [
    { id: 2, name: 'Southampton', slug: 'southampton' },
    { id: 1, name: 'Arsenal', slug: 'arsenal' },
    { id: 3, name: 'AFC Rushden & Diamonds', slug: 'afc-rushden--diamonds' }
  ] });
  renderDirectory();

  expect(screen.getByRole('status')).toHaveTextContent('Loading teams');
  expect(await screen.findByRole('link', { name: 'Southampton' })).toHaveAttribute('href', '/southampton');
  expect(screen.getByRole('link', { name: 'Arsenal' })).toHaveAttribute('href', '/arsenal');
  expect(screen.getByRole('link', { name: 'AFC Rushden & Diamonds' }))
    .toHaveAttribute('href', '/afc-rushden-and-diamonds');
  expect(screen.getAllByRole('heading', { level: 2 }).map(heading => heading.textContent)).toEqual(['A', 'S']);
});

test('shows an error and lets visitors retry a failed or invalid response', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  try {
    getTeamCoverage.mockResolvedValueOnce({}).mockResolvedValueOnce({
      teams: [{ id: 1, name: 'Southampton', slug: 'southampton' }]
    });
    renderDirectory();
    expect(await screen.findByRole('alert')).toHaveTextContent("couldn't load");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('link', { name: 'Southampton' })).toHaveAttribute('href', '/southampton');
    expect(getTeamCoverage).toHaveBeenCalledTimes(2);
  } finally {
    log.mockRestore();
  }
});

test('shows an empty state when coverage has no teams', async () => {
  getTeamCoverage.mockResolvedValue({ teams: [] });
  renderDirectory();
  await waitFor(() => expect(screen.getByText('No teams are currently available.')).toBeInTheDocument());
});
