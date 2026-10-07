import { render, screen } from '@testing-library/react';
import TeamPreferences from './TeamPreferences';
import { getTeamPreferences } from '../api/auth';
import { getTeamsByIds } from '../api';

jest.mock('../contexts/AuthContext.js', () => ({ useAuth: () => ({ isAuthenticated: true, loading: false }) }));
jest.mock('../api/auth.js', () => ({ getTeamPreferences: jest.fn() }));
jest.mock('../api.js', () => ({ getTeamsByIds: jest.fn() }));
jest.mock('../components/TeamSelection/TeamSelection', () => () => null);

test.each([65, '65'])('shows Southampton instead of Team 65 for saved ID %s', async (favoriteId) => {
  getTeamPreferences.mockResolvedValue({ data: { team_preferences: { favourite_team: favoriteId, followed_teams: [] } } });
  getTeamsByIds.mockResolvedValue([{ id: '65', name: 'Southampton', slug: 'southampton' }]);
  render(<TeamPreferences />);
  expect(await screen.findByRole('heading', { name: 'Southampton' })).toBeInTheDocument();
  expect(screen.queryByText('Team 65')).not.toBeInTheDocument();
  expect(getTeamsByIds).toHaveBeenCalledWith([favoriteId]);
});