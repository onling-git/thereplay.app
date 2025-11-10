// src/components/AdSense/PremiumBanner.jsx
import React from 'react';
import { useAdSense } from '../../contexts/AdSenseContext';
import './AdSenseAd.css';

const PremiumBanner = ({ 
  message = "✨ Enjoying ad-free experience with your premium subscription!",
  showUpgradePrompt = false,
  onUpgradeClick = null
}) => {
  const { shouldShowAds, hasActiveSubscription, hasAdFreeAccess } = useAdSense();

  // Only show for premium users with ad-free access
  if (shouldShowAds || !hasActiveSubscription || !hasAdFreeAccess) {
    return null;
  }

  return (
    <div className="premium-message">
      <span>{message}</span>
      {showUpgradePrompt && !hasAdFreeAccess && (
        <button
          onClick={onUpgradeClick}
          style={{
            marginLeft: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: '4px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '0.875rem'
          }}
        >
          Upgrade for Ad-Free
        </button>
      )}
    </div>
  );
};

export default PremiumBanner;