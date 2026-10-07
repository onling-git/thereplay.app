import { getTeamPreferences, updateTeamPreferences } from '../api/auth';
import { applyPendingTeamPreference, queueTeamPreference, saveTeamHubPreference } from './teamHubPreferences';

jest.mock('../api/auth', () => ({ getTeamPreferences: jest.fn(), updateTeamPreferences: jest.fn() }));

beforeEach(() => {
  jest.resetAllMocks();
  sessionStorage.clear();
});

test('never replaces an existing favourite when a guest selection is applied', async () => {
  queueTeamPreference(65, 'favourite');
  getTeamPreferences.mockResolvedValue({ data: { team_preferences: { favourite_team: 19, followed_teams: [] } } });
  const user = await applyPendingTeamPreference({ _id: 'user', favourite_team: 19 });
  expect(user.favourite_team).toBe(19);
  expect(updateTeamPreferences).not.toHaveBeenCalled();
  expect(sessionStorage.length).toBe(0);
});

test('persists a guest favourite on login when none exists', async () => {
  queueTeamPreference(65, 'favourite');
  getTeamPreferences.mockResolvedValue({ data: { team_preferences: { favourite_team: null, followed_teams: [19] } } });
  updateTeamPreferences.mockResolvedValue({ data: { user: { favourite_team: 65, followed_teams: [19] } } });
  expect(await applyPendingTeamPreference({ _id: 'user' })).toEqual({ _id: 'user', favourite_team: 65, followed_teams: [19] });
  expect(updateTeamPreferences).toHaveBeenCalledWith({ favourite_team: 65 });
  expect(sessionStorage.length).toBe(0);
});

test('following adds the team without replacing existing follows', async () => {
  getTeamPreferences.mockResolvedValue({ data: { team_preferences: { favourite_team: 19, followed_teams: [20] } } });
  updateTeamPreferences.mockResolvedValue({ data: { user: { favourite_team: 19, followed_teams: [20, 65] } } });
  await saveTeamHubPreference(65, 'follow');
  expect(updateTeamPreferences).toHaveBeenCalledWith({ followed_teams: [20, 65] });
});

test.each([{ favourite_team: '65', followed_teams: [] }, { favourite_team: 19, followed_teams: ['65'] }])('does not follow an already selected team: %p', async (preferences) => {
  getTeamPreferences.mockResolvedValue({ data: { team_preferences: preferences } });
  await saveTeamHubPreference(65, 'follow');
  expect(updateTeamPreferences).not.toHaveBeenCalled();
});

test('retains a pending choice after a failed save for an explicit retry', async () => {
  queueTeamPreference(65, 'favourite');
  getTeamPreferences.mockRejectedValue(new Error('Unavailable'));
  await expect(applyPendingTeamPreference({ _id: 'user' })).rejects.toThrow('Unavailable');
  expect(sessionStorage.length).toBe(1);
});

test('ignores malformed pending choices without changing preferences', async () => {
  sessionStorage.setItem('pending-team-hub-preference', 'invalid');
  expect(await applyPendingTeamPreference({ _id: 'user' })).toEqual({ _id: 'user' });
  expect(getTeamPreferences).not.toHaveBeenCalled();
});