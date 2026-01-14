// src/components/CookieConsent/CookieSettingsSection.jsx
import React, { useState } from 'react';
import { getCookieConsent, saveCookieConsent, clearCookieConsent, updateGoogleAnalyticsConsent } from '../../utils/cookieUtils';
import './CookieSettingsSection.css';

const CookieSettingsSection = () => {
  const [currentConsent, setCurrentConsent] = useState(() => getCookieConsent());
  const [showSettings, setShowSettings] = useState(false);
  const [cookiePreferences, setCookiePreferences] = useState(() => {
    const consent = getCookieConsent();
    return {
      necessary: true, // Always true
      analytics: consent?.analytics || false,
      marketing: consent?.marketing || false,
      personalization: consent?.personalization || false
    };
  });

  const handleToggle = (type) => {
    if (type === 'necessary') return; // Can't toggle necessary cookies
    
    setCookiePreferences(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  const handleSave = () => {
    const consent = {
      ...cookiePreferences,
      timestamp: new Date().toISOString(),
      method: 'account_settings'
    };
    
    saveCookieConsent(consent);
    setCurrentConsent(consent);
    updateGoogleAnalyticsConsent();
    setShowSettings(false);
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all cookie preferences? This will remove all cookies and reset your preferences.')) {
      clearCookieConsent();
      setCookiePreferences({
        necessary: true,
        analytics: false,
        marketing: false,
        personalization: false
      });
      setCurrentConsent(null);
      updateGoogleAnalyticsConsent();
    }
  };

  return (
    <div className="cookie-settings-section">
      <div className="section-header">
        <h2>Privacy & Cookie Settings</h2>
        <button 
          className="manage-btn"
          onClick={() => setShowSettings(!showSettings)}
        >
          {showSettings ? 'Hide Settings' : 'Manage'}
        </button>
      </div>

      <div className="cookie-status">
        <div className="status-item">
          <span className="status-label">Cookie Consent:</span>
          <span className={`status-value ${currentConsent ? 'granted' : 'pending'}`}>
            {currentConsent ? 'Preferences Set' : 'Not Set'}
          </span>
        </div>
        {currentConsent && (
          <div className="status-item">
            <span className="status-label">Last Updated:</span>
            <span className="status-value">
              {new Date(currentConsent.timestamp).toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {showSettings && (
        <div className="cookie-preferences">
          <div className="preferences-header">
            <h3>Cookie Preferences</h3>
            <p>Control how we use cookies to improve your experience</p>
          </div>

          <div className="cookie-categories">
            <div className="cookie-category">
              <div className="category-header">
                <div>
                  <h4>Necessary Cookies</h4>
                  <p>Required for the website to function properly</p>
                </div>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    id="necessary"
                    checked={true}
                    disabled={true}
                  />
                  <label htmlFor="necessary"></label>
                  <span className="toggle-status">Always On</span>
                </div>
              </div>
            </div>

            <div className="cookie-category">
              <div className="category-header">
                <div>
                  <h4>Analytics Cookies</h4>
                  <p>Help us understand how you use the site</p>
                </div>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    id="analytics"
                    checked={cookiePreferences.analytics}
                    onChange={() => handleToggle('analytics')}
                  />
                  <label htmlFor="analytics"></label>
                  <span className="toggle-status">
                    {cookiePreferences.analytics ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            <div className="cookie-category">
              <div className="category-header">
                <div>
                  <h4>Marketing Cookies</h4>
                  <p>Used for personalized advertising</p>
                </div>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    id="marketing"
                    checked={cookiePreferences.marketing}
                    onChange={() => handleToggle('marketing')}
                  />
                  <label htmlFor="marketing"></label>
                  <span className="toggle-status">
                    {cookiePreferences.marketing ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>

            <div className="cookie-category">
              <div className="category-header">
                <div>
                  <h4>Personalization Cookies</h4>
                  <p>Remember your preferences and settings</p>
                </div>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    id="personalization"
                    checked={cookiePreferences.personalization}
                    onChange={() => handleToggle('personalization')}
                  />
                  <label htmlFor="personalization"></label>
                  <span className="toggle-status">
                    {cookiePreferences.personalization ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-actions">
            <button 
              className="save-btn"
              onClick={handleSave}
            >
              Save Preferences
            </button>
            <button 
              className="clear-btn"
              onClick={handleClearAll}
            >
              Clear All Cookies
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CookieSettingsSection;