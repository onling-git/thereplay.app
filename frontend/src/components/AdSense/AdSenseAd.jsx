// src/components/AdSense/AdSenseAd.jsx
import React, { useEffect, useRef } from 'react';
import { useAdSense } from '../../contexts/AdSenseContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { isCookieTypeAllowed } from '../../utils/cookieUtils';
import { ADSENSE_CONFIG } from '../../config/adsense';
import './AdSenseAd.css';

const AdSenseAd = ({ 
  client = ADSENSE_CONFIG.CLIENT_ID, // Use config default
  slot, 
  format = "auto",
  responsive = true,
  style = {},
  className = "",
  layout = "",
  layoutKey = ""
}) => {
  const { shouldShowAds, pushAd } = useAdSense();
  const { hasActiveSubscription } = useSubscription();
  const adRef = useRef(null);
  const adPushed = useRef(false); // Track if ad has been pushed

  // Check if ads should be shown based on subscription and cookie consent
  const shouldDisplayAds = shouldShowAds && !hasActiveSubscription;
  
  // Determine if we should show personalized ads based on marketing consent
  const shouldPersonalizeAds = isCookieTypeAllowed('marketing');

  // Validate AdSense configuration (only in development)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      if (client.includes('xxxxxxxxx')) {
        console.warn('⚠️  AdSense: Using placeholder client ID. Please update ADSENSE_CONFIG.CLIENT_ID in src/config/adsense.js');
      }
      if (slot && /^[0-9]{10}$/.test(slot) && parseInt(slot) < 2000000000) {
        console.warn(`⚠️  AdSense: Slot "${slot}" appears to be a placeholder. Please use actual ad slot IDs from your AdSense dashboard.`);
      }
    }
  }, [client, slot]);

  useEffect(() => {
    // Early returns for invalid states
    if (!shouldDisplayAds || !adRef.current || adPushed.current) return;

    // Check if ad slot is already initialized
    const alreadyInitialized = adRef.current.getAttribute('data-adsbygoogle-status');
    if (alreadyInitialized) {
      adPushed.current = true;
      return;
    }

    // Configure AdSense consent mode based on cookie preferences
    if (window.gtag && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', {
        'ad_storage': shouldPersonalizeAds ? 'granted' : 'denied',
        'ad_user_data': shouldPersonalizeAds ? 'granted' : 'denied',
        'ad_personalization': shouldPersonalizeAds ? 'granted' : 'denied'
      });
    }

    // Use requestIdleCallback to load ads when browser is idle (after content)
    // This ensures ads don't block initial content rendering
    const initializeAd = () => {
      if (adRef.current && !adPushed.current) {
        pushAd();
        adPushed.current = true;
      }
    };

    // Use requestIdleCallback for better performance, fallback to setTimeout
    if ('requestIdleCallback' in window) {
      const idleCallbackId = requestIdleCallback(initializeAd, { timeout: 2000 });
      return () => cancelIdleCallback(idleCallbackId);
    } else {
      const timerId = setTimeout(initializeAd, 300);
      return () => clearTimeout(timerId);
    }
  }, [shouldDisplayAds, shouldPersonalizeAds, pushAd]);

  // Don't render anything if ads shouldn't be shown
  if (!shouldDisplayAds) {
    return null;
  }

  // Default styles for the ad container
  const defaultStyle = {
    display: 'block',
    minHeight: '90px', // Minimum height to prevent layout shift
    ...style
  };

  return (
    <div className={`adsense-container ${className}`}>
      {!shouldPersonalizeAds && (
        <div className="ad-privacy-notice">
          <small>Non-personalized ads</small>
        </div>
      )}
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={defaultStyle}
        data-ad-client={client}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive.toString()}
        data-ad-layout={layout}
        data-ad-layout-key={layoutKey}
        {...(!shouldPersonalizeAds && { 'data-npa': '1' })} // Add npa=1 for non-personalized ads
      ></ins>
    </div>
  );
};

export default AdSenseAd;