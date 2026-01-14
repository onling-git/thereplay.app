// src/hooks/useTeamOnboarding.js
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ONBOARDING_STORAGE_KEY = 'team_onboarding_completed';

// Global state for triggering onboarding from anywhere
let globalOnboardingTrigger = null;

export const triggerTeamOnboarding = () => {
  if (globalOnboardingTrigger) {
    globalOnboardingTrigger();
  }
};

export const useTeamOnboarding = () => {
  const { user, isAuthenticated } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Register global trigger
  useEffect(() => {
    globalOnboardingTrigger = () => {
      setShowOnboarding(true);
    };
    
    // Cleanup
    return () => {
      globalOnboardingTrigger = null;
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Check if user needs onboarding
      const hasCompletedOnboarding = localStorage.getItem(ONBOARDING_STORAGE_KEY);
      const hasTeamPreferences = user.favourite_team || (user.followed_teams && user.followed_teams.length > 0);
      
      // Show onboarding if:
      // 1. User hasn't completed onboarding before, AND
      // 2. User doesn't have any team preferences set
      if (!hasCompletedOnboarding && !hasTeamPreferences) {
        setShowOnboarding(true);
      }
    }
  }, [isAuthenticated, user]);

  const startOnboarding = () => {
    setShowOnboarding(true);
  };

  const completeOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  };

  const skipOnboarding = () => {
    setShowOnboarding(false);
    localStorage.setItem(ONBOARDING_STORAGE_KEY, 'true');
  };

  return {
    showOnboarding,
    startOnboarding,
    completeOnboarding,
    skipOnboarding
  };
};