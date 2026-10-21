// src/components/CookieConsent/CookieSettingsButton.jsx
import React from 'react';
import { OPEN_COOKIE_SETTINGS } from '../../utils/cookieUtils';
import { isCrawler } from '../../utils/isCrawler';
import './CookieSettingsButton.css';

const CookieSettingsButton = () => {
  if (isCrawler()) return null;

  return (
    <>
      <button 
        className="cookie-settings-button"
        onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))}
        title="Cookie Settings"
      >
        🍪 Cookie Settings
      </button>
      
    </>
  );
};

export default CookieSettingsButton;