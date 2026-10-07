import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { updateTeamPreferences } from '../api/auth';
import { queueTeamPreference } from '../utils/teamHubPreferences';

jest.mock('../api/base', () => ({ API_BASE: '' }));

function PreferencesProbe() {
  const { user, login, register, isAuthenticated, loading, teamPreferenceError } = useAuth();
  return <>
    <output data-testid="favourite">{user?.favourite_team || 'none'}</output>
    <output data-testid="following">{user?.followed_teams?.join(',') || 'none'}</output>
    <output data-testid="auth">{loading ? 'loading' : isAuthenticated ? 'signed-in' : 'guest'}</output>
    <button onClick={() => login('test@example.invalid', 'test-password')}>Login</button>
    <button onClick={() => register({ email: 'test@example.invalid', password: 'test-password' })}>Register</button>
    {teamPreferenceError && <p role="alert">{teamPreferenceError}</p>}
  </>;
}

beforeEach(() => sessionStorage.clear());
afterEach(() => jest.restoreAllMocks());

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

test.each(['Login', 'Register'])('applies a guest favourite through %s before publishing the signed-in user', async (buttonName) => {
  const fetchSpy = jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });
  render(<AuthProvider><PreferencesProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('guest'));
  queueTeamPreference(65, 'favourite');
  fetchSpy
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { user: { _id: 'current-user', favourite_team: null } } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { team_preferences: { favourite_team: null, followed_teams: [] } } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { user: { _id: 'current-user', favourite_team: 65, followed_teams: [] } } }) });
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('signed-in'));
  expect(screen.getByTestId('favourite')).toHaveTextContent('65');
  expect(sessionStorage.length).toBe(0);
  expect(fetchSpy.mock.calls[3][1].body).toBe(JSON.stringify({ favourite_team: 65 }));
});

test('discards a guest favourite after login when that account already has one', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });
  render(<AuthProvider><PreferencesProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('guest'));
  queueTeamPreference(65, 'favourite');
  fetchSpy
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { user: { _id: 'current-user', favourite_team: 19 } } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { team_preferences: { favourite_team: 19, followed_teams: [] } } }) });
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));
  await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('signed-in'));
  expect(screen.getByTestId('favourite')).toHaveTextContent('19');
  expect(fetchSpy).toHaveBeenCalledTimes(3);
  expect(sessionStorage.length).toBe(0);
});

test('restores a pending guest follow after a refresh without dropping existing follows', async () => {
  queueTeamPreference(65, 'follow');
  jest.spyOn(global, 'fetch')
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { user: { _id: 'current-user', favourite_team: 19, followed_teams: [20] } } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { team_preferences: { favourite_team: 19, followed_teams: [20] } } }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { user: { _id: 'current-user', favourite_team: 19, followed_teams: [20, 65] } } }) });
  render(<AuthProvider><PreferencesProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('signed-in'));
  expect(screen.getByTestId('following')).toHaveTextContent('20,65');
  expect(screen.getByTestId('favourite')).toHaveTextContent('19');
});

test('a failed pending save does not fail login and keeps the choice for retry', async () => {
  const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) });
  render(<AuthProvider><PreferencesProbe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId('auth')).toHaveTextContent('guest'));
  queueTeamPreference(65, 'favourite');
  fetchSpy
    .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { user: { _id: 'current-user', favourite_team: null } } }) })
    .mockRejectedValueOnce(new Error('Unavailable'));
  fireEvent.click(screen.getByRole('button', { name: 'Login' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('selection could not be saved');
  expect(screen.getByTestId('auth')).toHaveTextContent('signed-in');
  expect(sessionStorage.length).toBe(1);
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