// src/components/AdSense/AdSenseAd.jsx
import React, { useEffect, useRef } from 'react';
import { useAdSense } from '../../contexts/AdSenseContext';
import './AdSenseAd.css';

const AdSenseAd = ({ 
  client = "ca-pub-xxxxxxxxxxxxxxxxx", // Replace with your AdSense client ID
  slot, 
  format = "auto",
  responsive = true,
  style = {},
  className = "",
  layout = "",
  layoutKey = ""
}) => {
  const { shouldShowAds, pushAd } = useAdSense();
  const adRef = useRef(null);

  useEffect(() => {
    if (shouldShowAds && adRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        pushAd();
      }, 100);

      return () => clearTimeout(timer);
    }
  }, [shouldShowAds, pushAd]);

  // Don't render anything if ads shouldn't be shown
  if (!shouldShowAds) {
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
      ></ins>
    </div>
  );
};

export default AdSenseAd;