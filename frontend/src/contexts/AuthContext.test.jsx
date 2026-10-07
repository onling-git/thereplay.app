import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { updateTeamPreferences } from '../api/auth';

jest.mock('../api/base', () => ({ API_BASE: '' }));

function PreferencesProbe() {
  const { user } = useAuth();
  return <output data-testid="favourite">{user?.favourite_team || 'none'}</output>;
}

test('successful preference saves and removals refresh the current user without reloading', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({
    ok: true, json: async () => ({ data: { user: { _id: 'current-user', favourite_team: 1 } } }),
  });
  render(<AuthProvider><PreferencesProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('favourite')).toHaveTextContent('1'));
  fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { user: { _id: 'current-user', favourite_team: 2, followed_teams: [] } } }) });
  await act(async () => updateTeamPreferences({ favourite_team: 2 }));
  expect(screen.getByTestId('favourite')).toHaveTextContent('2');
  fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { user: { _id: 'current-user', favourite_team: null, followed_teams: [] } } }) });
  await act(async () => updateTeamPreferences({ favourite_team: null }));
  expect(screen.getByTestId('favourite')).toHaveTextContent('none');
  fetchSpy.mockRestore();
});

test('a late save for another account cannot change the current favourite', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ({ data: { user: { _id: 'current-user', favourite_team: 1 } } }) });
  render(<AuthProvider><PreferencesProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('favourite')).toHaveTextContent('1'));
  fetchSpy.mockResolvedValueOnce({ ok: true, json: async () => ({ data: { user: { _id: 'another-user', favourite_team: 2 } } }) });
  await act(async () => updateTeamPreferences({ favourite_team: 2 }));
  expect(screen.getByTestId('favourite')).toHaveTextContent('1');
  fetchSpy.mockRestore();
});