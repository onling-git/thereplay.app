import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { saveCookieConsent, getCookieConsent, COOKIE_CONSENT_CHANGED, OPEN_COOKIE_SETTINGS } from '../../utils/cookieUtils';
import { isCrawler } from '../../utils/isCrawler';
import './CookieConsentBanner.css';

const defaultPreferences = { necessary: true, analytics: false, marketing: false, personalization: false };
const categories = [
  ['analytics', 'Analytics Cookies', 'Help us understand how visitors use the website.'],
  ['marketing', 'Marketing Cookies', 'Support advertising and measure its effectiveness.'],
  ['personalization', 'Personalization Cookies', 'Remember optional preferences and personalize your experience.']
];

const CookieConsentBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [cookiePreferences, setCookiePreferences] = useState(defaultPreferences);
  const { hasActiveSubscription, loading } = useSubscription();
  const { loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isCrawler() || authLoading || loading) return;
    if (!getCookieConsent()) {
      const timer = setTimeout(() => {
        if (!getCookieConsent()) setShowBanner(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasActiveSubscription, authLoading, loading]);

  useEffect(() => {
    const open = () => {
      if (isCrawler()) return;
      setCookiePreferences({ ...defaultPreferences, ...getCookieConsent() });
      setShowDetails(false);
      setShowBanner(true);
    };
    const close = () => { setShowBanner(false); setShowDetails(false); };
    window.addEventListener(OPEN_COOKIE_SETTINGS, open);
    window.addEventListener(COOKIE_CONSENT_CHANGED, close);
    return () => {
      window.removeEventListener(OPEN_COOKIE_SETTINGS, open);
      window.removeEventListener(COOKIE_CONSENT_CHANGED, close);
    };
  }, []);

  useEffect(() => {
    if (!hasActiveSubscription) setShowDetails(false);
  }, [hasActiveSubscription]);

  const save = (preferences, method) => {
    saveCookieConsent({ ...preferences, necessary: true, method });
    setShowBanner(false);
    setShowDetails(false);
  };
  const accept = () => save({ necessary: true, analytics: true, marketing: true, personalization: true }, 'accept_all');
  const pay = () => {
    setShowBanner(false);
    navigate('/subscription/plans');
  };

  if (!showBanner || isCrawler()) return null;

  return (
    <section className="cookie-consent-banner" aria-label="Cookie consent">
      <div className="cookie-consent-container">
        <div className="cookie-consent-header">
          <h2>{showDetails ? 'Cookie Preferences' : 'Your Privacy Matters'}</h2>
          <button type="button" className="cookie-consent-dismiss" aria-label="Dismiss cookie notice without choosing" onClick={() => setShowBanner(false)}>Close</button>
        </div>
        {showDetails && hasActiveSubscription ? (
          <>
            <div className="cookie-preferences">
              <div className="cookie-category">
                <label><input type="checkbox" checked disabled /> Necessary Cookies (required)</label>
                <p>Essential cookies remain enabled for login, security and your consent choice.</p>
              </div>
              {categories.map(([key, label, description]) => (
                <div className="cookie-category" key={key}>
                  <label htmlFor={`cookie-${key}`}>
                    <input id={`cookie-${key}`} type="checkbox" checked={cookiePreferences[key]} onChange={() => setCookiePreferences(previous => ({ ...previous, [key]: !previous[key] }))} />
                    {label}
                  </label>
                  <p>{description}</p>
                </div>
              ))}
            </div>
            <div className="cookie-consent-buttons">
              <button type="button" className="btn-save" onClick={() => save(cookiePreferences, 'customize')}>Save My Preferences</button>
              <button type="button" className="btn-back" onClick={() => setShowDetails(false)}>Back</button>
            </div>
          </>
        ) : (
          <>
            <div className="cookie-consent-content">
              <p>{hasActiveSubscription
                ? 'Your subscription includes ad-free browsing. Choose whether to allow optional cookies, reject them, or manage each category.'
                : 'Accept all cookies for analytics, advertising and personalization, or pay for an ad-free subscription. You can keep browsing without choosing; optional cookies stay off until you give consent.'}</p>
            </div>
            <div className="cookie-consent-buttons">
              <button type="button" className="btn-accept-all" onClick={accept}>Accept All Cookies</button>
              {hasActiveSubscription ? (
                <>
                  <button type="button" className="btn-reject" onClick={() => save(defaultPreferences, 'reject_all')}>Reject Optional Cookies</button>
                  <button type="button" className="btn-customize" onClick={() => { setCookiePreferences({ ...defaultPreferences, ...getCookieConsent() }); setShowDetails(true); }}>Manage Preferences</button>
                </>
              ) : <button type="button" className="btn-subscribe" onClick={pay}>Pay for Ad-Free Access</button>}
            </div>
          </>
        )}
        <div className="cookie-consent-footer">
          <p>Essential cookies are always required. Browsing or paying does not grant optional cookie consent. <a href="/privacy-policy">Privacy Policy</a></p>
        </div>
      </div>
    </section>
  );
};

export default CookieConsentBanner;
