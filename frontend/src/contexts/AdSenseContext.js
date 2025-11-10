// src/contexts/AdSenseContext.js
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';

const AdSenseContext = createContext();

export const AdSenseProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const { hasActiveSubscription, hasFeatureAccess } = useSubscription();
  const [adsLoaded, setAdsLoaded] = useState(false);

  // Check if user should see ads
  const shouldShowAds = () => {
    // Always show ads for non-authenticated users
    if (!isAuthenticated || isAuthenticated === false) {
      return true;
    }

    // Hide ads for users with active subscription and ad_free feature
    if (hasActiveSubscription && hasFeatureAccess('ad_free')) {
      return false;
    }

    // Show ads for authenticated users without subscription or ad_free feature
    return true;
  };

  // Initialize AdSense
  useEffect(() => {
    if (shouldShowAds() && !adsLoaded && typeof window !== 'undefined') {
      // Load AdSense script if not already loaded
      if (!window.adsbygoogle) {
        const script = document.createElement('script');
        script.async = true;
        script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
        script.crossOrigin = 'anonymous';
        
        script.onload = () => {
          setAdsLoaded(true);
        };
        
        script.onerror = () => {
          console.error('Failed to load AdSense script');
        };

        document.head.appendChild(script);
      } else {
        setAdsLoaded(true);
      }
    }
  }, [isAuthenticated, hasActiveSubscription, hasFeatureAccess, adsLoaded]);

  // Push ads to AdSense queue
  const pushAd = () => {
    if (typeof window !== 'undefined' && window.adsbygoogle && shouldShowAds()) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        console.error('AdSense push error:', error);
      }
    }
  };

  // Refresh ads (useful for SPA navigation)
  const refreshAds = () => {
    if (shouldShowAds() && typeof window !== 'undefined' && window.adsbygoogle) {
      try {
        // Clear existing ads
        const ads = document.querySelectorAll('.adsbygoogle');
        ads.forEach(ad => {
          ad.innerHTML = '';
          ad.removeAttribute('data-adsbygoogle-status');
        });
        
        // Push new ads
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        console.error('AdSense refresh error:', error);
      }
    }
  };

  const value = {
    shouldShowAds: shouldShowAds(),
    adsLoaded,
    pushAd,
    refreshAds,
    isAuthenticated,
    hasActiveSubscription,
    hasAdFreeAccess: hasFeatureAccess('ad_free')
  };

  return (
    <AdSenseContext.Provider value={value}>
      {children}
    </AdSenseContext.Provider>
  );
};

export const useAdSense = () => {
  const context = useContext(AdSenseContext);
  if (!context) {
    throw new Error('useAdSense must be used within an AdSenseProvider');
  }
  return context;
};