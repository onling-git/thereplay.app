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

  // Check if ads should be shown based on subscription and cookie consent
  const shouldDisplayAds = shouldShowAds && !hasActiveSubscription;
  
  // Determine if we should show personalized ads based on marketing consent
  const shouldPersonalizeAds = isCookieTypeAllowed('marketing');

  useEffect(() => {
    if (shouldDisplayAds && adRef.current) {
      // Configure AdSense consent mode based on cookie preferences
      if (window.gtag && typeof window.gtag === 'function') {
        window.gtag('consent', 'update', {
          'ad_storage': shouldPersonalizeAds ? 'granted' : 'denied',
          'ad_user_data': shouldPersonalizeAds ? 'granted' : 'denied', 
          'ad_personalization': shouldPersonalizeAds ? 'granted' : 'denied'
        });
      }
      
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        pushAd();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [shouldDisplayAds, shouldPersonalizeAds, pushAd]);

  // Don't render anything if ads shouldn't be shown
  if (!shouldDisplayAds) {
    // Show a placeholder for premium users
    if (hasActiveSubscription) {
      return (
        <div className={`adsense-container premium-placeholder ${className}`}>
          <div className="premium-message">
            🎉 Ad-free experience for premium members
          </div>
        </div>
      );
    }
    
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