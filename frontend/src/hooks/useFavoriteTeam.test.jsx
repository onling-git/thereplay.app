import { act, renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '../contexts/AuthContext';
import { getTeamsByIds } from '../api';
import { useFavoriteTeam } from './useFavoriteTeam';

jest.mock('../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../api', () => ({ getTeamsByIds: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

test('does not fetch favourites for guests', () => {
  useAuth.mockReturnValue({ isAuthenticated: false });
  const { result } = renderHook(useFavoriteTeam);
  expect(result.current).toEqual({ favoriteTeam: null, loading: false, error: null });
  expect(getTeamsByIds).not.toHaveBeenCalled();
});

test('resolves a favourite slug and immediately clears it on logout', async () => {
  useAuth.mockReturnValue({ isAuthenticated: true, user: { favourite_team: 1 } });
  getTeamsByIds.mockResolvedValue([{ id: 1, slug: 'arsenal' }]);
  const { result, rerender } = renderHook(useFavoriteTeam);
  expect(result.current.loading).toBe(true);
  await waitFor(() => expect(result.current.favoriteTeam?.slug).toBe('arsenal'));
  useAuth.mockReturnValue({ isAuthenticated: false });
  rerender();
  expect(result.current.favoriteTeam).toBeNull();
  expect(result.current.loading).toBe(false);
});

test('ignores an older request after changing favourites', async () => {
  let resolveOld;
  useAuth.mockReturnValue({ isAuthenticated: true, user: { favourite_team: 1 } });
  getTeamsByIds.mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  const { result, rerender } = renderHook(useFavoriteTeam);
  useAuth.mockReturnValue({ isAuthenticated: true, user: { favourite_team: 2 } });
  getTeamsByIds.mockResolvedValueOnce([{ id: 2, slug: 'southampton' }]);
  rerender();
  expect(result.current.favoriteTeam).toBeNull();
  await waitFor(() => expect(result.current.favoriteTeam?.slug).toBe('southampton'));
  await act(async () => resolveOld([{ id: 1, slug: 'arsenal' }]));
  expect(result.current.favoriteTeam?.slug).toBe('southampton');
});

test.each([{ teams: [] }, { teams: [{ id: 1 }] }])('finishes with an error for unavailable destinations: %p', async ({ teams }) => {
  useAuth.mockReturnValue({ isAuthenticated: true, user: { favourite_team: 1 } });
  getTeamsByIds.mockResolvedValue(teams);
  const { result } = renderHook(useFavoriteTeam);
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.error).toBe('Favorite team not found');
});