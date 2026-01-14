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
  const [favoriteTeam, setFavoriteTeam] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchFavoriteTeamData = async () => {
      // Reset state
      setFavoriteTeam(null);
      setError(null);
      
      // If not authenticated or no favorite team, return early
      if (!isAuthenticated || !user?.favourite_team) {
        return;
      }

      setLoading(true);
      
      try {
        console.log('🔍 Fetching favorite team data for ID:', user.favourite_team);
        
        // Fetch teams from API
        const teamsResponse = await getTeams({ limit: 1000 });
        const allTeams = teamsResponse?.teams || teamsResponse || [];
        
        // Find the user's favorite team
        const favoriteTeamData = allTeams.find(team => team.id === user.favourite_team);
        
        if (favoriteTeamData) {
          console.log('✅ Found favorite team data:', favoriteTeamData);
          setFavoriteTeam(favoriteTeamData);
        } else {
          console.warn('⚠️ Favorite team not found in teams list');
          setError('Favorite team not found');
        }
      } catch (err) {
        console.error('❌ Failed to fetch favorite team data:', err);
        setError(err.message || 'Failed to load favorite team');
      } finally {
        setLoading(false);
      }
    };

    fetchFavoriteTeamData();
  }, [isAuthenticated, user?.favourite_team]);

  return { favoriteTeam, loading, error };
};