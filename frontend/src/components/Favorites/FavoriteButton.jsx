// src/components/Favorites/FavoriteButton.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { checkFavoriteStatus, toggleFavoriteMatch } from '../../api/favorites';
import './FavoriteButton.css';

const FavoriteButton = ({ matchId, className = '', size = 'medium', onToggle }) => {
  const { isAuthenticated } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);

  // Check if match is favorited when component mounts
  useEffect(() => {
    if (isAuthenticated && matchId) {
      checkFavoriteStatusAsync();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, matchId]);

  const checkFavoriteStatusAsync = async () => {
    try {
      setChecking(true);
      const response = await checkFavoriteStatus(matchId);
      setIsFavorited(response?.data?.is_favorited || false);
    } catch (error) {
      console.error('Failed to check favorite status:', error);
    } finally {
      setChecking(false);
    }
  };

  const handleToggle = async (e) => {
    e.stopPropagation(); // Prevent event bubbling
    
    if (!isAuthenticated) {
      // Could trigger auth modal or show tooltip
      return;
    }

    if (loading) return;

    try {
      setLoading(true);
      const result = await toggleFavoriteMatch(matchId);
      
      if (result.success) {
        const newIsFavorited = result.action === 'added';
        setIsFavorited(newIsFavorited);
        
        // Call onToggle callback if provided
        if (onToggle) {
          onToggle(newIsFavorited, result.action);
        }
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <button 
        className={`favorite-button unauthenticated ${size} ${className}`}
        disabled
      >
        ⭐
      </button>
    );
  }

  if (checking) {
    return (
      <button 
        className={`favorite-button checking ${size} ${className}`}
        disabled
      >
        ⏳
      </button>
    );
  }

  return (
    <button
      className={`favorite-button ${isFavorited ? 'favorited' : 'not-favorited'} ${size} ${loading ? 'loading' : ''} ${className}`}
      onClick={handleToggle}
      disabled={loading}
    >
      {loading ? '⏳' : (isFavorited ? '⭐' : '☆')}
    </button>
  );
};

export default FavoriteButton;