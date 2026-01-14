// src/components/CookieConsent/CookieSettingsButton.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import { getCookieConsent, clearCookieConsent } from '../../utils/cookieUtils';
import CookieConsentBanner from './CookieConsentBanner';
import './CookieSettingsButton.css';

const CookieSettingsButton = () => {
  const { isAuthenticated } = useAuth();
  const [showBanner, setShowBanner] = useState(false);

  // Only show for non-authenticated users
  if (isAuthenticated) {
    return null;
  }

  const handleOpenSettings = () => {
    // Clear current consent to force the banner to show
    const currentConsent = getCookieConsent();
    
    if (currentConsent) {
      // Temporarily clear consent to show banner
      clearCookieConsent();
      setShowBanner(true);
    } else {
      setShowBanner(true);
    }
  };

  const handleBannerClose = () => {
    setShowBanner(false);
  };

  return (
    <>
      <button 
        className="cookie-settings-button"
        onClick={handleOpenSettings}
        title="Cookie Settings"
      >
        🍪 Cookie Settings
      </button>
      
      {showBanner && (
        <div onClose={handleBannerClose}>
          <CookieConsentBanner />
        </div>
      )}
    </>
  );
};

export default CookieSettingsButton;