// src/contexts/AdSenseContext.js
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext.js';
import { useSubscription } from './SubscriptionContext';
import { COOKIE_CONSENT_CHANGED, getCookieConsent, initializeTracking, updateGoogleAnalyticsConsent } from '../utils/cookieUtils';
import { isCrawler } from '../utils/isCrawler';
import { ADSENSE_CONFIG } from '../config/adsense';

const AdSenseContext = createContext();

export const AdSenseProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const { hasActiveSubscription, hasFeatureAccess, loading } = useSubscription();
  const [adsLoaded, setAdsLoaded] = useState(false);
  const [cookieConsent, setCookieConsent] = useState(getCookieConsent);
  const marketingConsent = cookieConsent?.marketing === true;

  useEffect(() => {
    const update = () => {
      updateGoogleAnalyticsConsent();
      initializeTracking();
      setCookieConsent(getCookieConsent());
    };
    window.addEventListener(COOKIE_CONSENT_CHANGED, update);
    window.addEventListener('storage', update);
    initializeTracking();
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGED, update);
      window.removeEventListener('storage', update);
    };
  }, []);

  const shouldShowAds = useCallback(
    () => marketingConsent && !authLoading && !loading && !hasActiveSubscription && !isCrawler(),
    [marketingConsent, authLoading, loading, hasActiveSubscription]
  );

  // Initialize AdSense
  useEffect(() => {
    const shouldShow = shouldShowAds();
    if (shouldShow && !adsLoaded && typeof window !== 'undefined') {
      let script = document.getElementById('replay-adsense');
      if (script?.dataset.loaded === 'true') {
        setAdsLoaded(true);
        return;
      }
      const onLoad = () => {
        script.dataset.loaded = 'true';
        setAdsLoaded(true);
      };
      const onError = () => console.error('Failed to load AdSense script');
      const isNew = !script;
      if (isNew) {
        script = document.createElement('script');
        script.id = 'replay-adsense';
        script.async = true;
        script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CONFIG.CLIENT_ID}`;
        script.crossOrigin = 'anonymous';
      }
      updateGoogleAnalyticsConsent();
      script.addEventListener('load', onLoad);
      script.addEventListener('error', onError);
      if (isNew) document.head.appendChild(script);
      return () => {
        script.removeEventListener('load', onLoad);
        script.removeEventListener('error', onError);
      };
    }
  }, [adsLoaded, shouldShowAds]);

  // Push ads to AdSense queue
  const pushAd = useCallback(() => {
    if (typeof window !== 'undefined' && window.adsbygoogle && shouldShowAds()) {
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        // Silently handle duplicate ad errors - this is expected behavior
        if (error.message && !error.message.includes('already have ads')) {
          console.error('AdSense push error:', error);
        }
      }
    }
  }, [shouldShowAds]);

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