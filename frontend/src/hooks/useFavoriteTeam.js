// src/hooks/useFavoriteTeam.js
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getTeams } from '../api';

/**
 * Custom hook to get the user's favorite team data
 * @returns {Object} - { favoriteTeam, loading, error }
 */
export const useFavoriteTeam = () => {
  const { user, isAuthenticated } = useAuth();
  const favoriteId = isAuthenticated ? user?.favourite_team : null;
  const [result, setResult] = useState({ id: null, team: null, loading: false, error: null });

  useEffect(() => {
    let cancelled = false;
    const fetchFavoriteTeamData = async () => {
      if (!favoriteId) {
        setResult({ id: null, team: null, loading: false, error: null });
        return;
      }

      setResult({ id: favoriteId, team: null, loading: true, error: null });
      try {
        const teamsResponse = await getTeams({ limit: 1000 });
        const allTeams = teamsResponse?.teams || teamsResponse || [];
        const team = allTeams.find((entry) => String(entry.id) === String(favoriteId));
        if (!team?.slug) throw new Error('Favorite team not found');
        if (!cancelled) setResult({ id: favoriteId, team, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setResult({ id: favoriteId, team: null, loading: false, error: err.message || 'Failed to load favorite team' });
      }
    };

    fetchFavoriteTeamData();
    return () => { cancelled = true; };
  }, [favoriteId]);

  if (!favoriteId) return { favoriteTeam: null, loading: false, error: null };
  if (result.id !== favoriteId) return { favoriteTeam: null, loading: true, error: null };
  return { favoriteTeam: result.team, loading: result.loading, error: result.error };
};