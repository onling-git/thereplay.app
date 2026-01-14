// src/components/CookieConsent/CookieConsentBanner.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { createCheckoutSession } from '../../api/subscriptionApi';
import { saveCookieConsent, getCookieConsent, updateGoogleAnalyticsConsent } from '../../utils/cookieUtils';
import './CookieConsentBanner.css';

const CookieConsentBanner = () => {
  const [showBanner, setShowBanner] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [isProcessingSubscription, setIsProcessingSubscription] = useState(false);
  const { isAuthenticated } = useAuth();
  const { hasActiveSubscription } = useSubscription();

  const [cookiePreferences, setCookiePreferences] = useState({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
    personalization: false
  });

  useEffect(() => {
    // Check if user has already made a choice
    const consent = getCookieConsent();
    const hasSubscription = hasActiveSubscription;
    
    // Show banner if no consent given and no active subscription
    if (!consent && !hasSubscription) {
      // Small delay to let the page load first
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [hasActiveSubscription]);

  const handleAcceptAll = () => {
    const consent = {
      necessary: true,
      analytics: true,
      marketing: true,
      personalization: true,
      timestamp: new Date().toISOString(),
      method: 'accept_all'
    };
    
    saveCookieConsent(consent);
    setShowBanner(false);
    
    // Update Google consent mode
    updateGoogleAnalyticsConsent();
    
    // Initialize tracking scripts
    initializeTrackingScripts(consent);
  };

  const handleRejectAll = () => {
    const consent = {
      necessary: true,
      analytics: false,
      marketing: false,
      personalization: false,
      timestamp: new Date().toISOString(),
      method: 'reject_all'
    };
    
    saveCookieConsent(consent);
    setShowBanner(false);
    
    // Update Google consent mode
    updateGoogleAnalyticsConsent();
  };

  const handleCustomize = () => {
    setShowDetails(true);
  };

  const handleSavePreferences = () => {
    const consent = {
      ...cookiePreferences,
      timestamp: new Date().toISOString(),
      method: 'customize'
    };
    
    saveCookieConsent(consent);
    setShowBanner(false);
    setShowDetails(false);
    
    // Update Google consent mode
    updateGoogleAnalyticsConsent();
    
    // Initialize tracking scripts based on preferences
    initializeTrackingScripts(consent);
  };

  const handleSubscribeForAdFree = async () => {
    if (!isAuthenticated) {
      // Store redirect intent and go to login
      localStorage.setItem('postLoginRedirect', 'cookie-consent-subscription');
      window.location.href = '/login';
      return;
    }

    setIsProcessingSubscription(true);
    
    try {
      // Use monthly subscription price ID from your existing setup
      const response = await createCheckoutSession('price_1SRF2XCIJObwi2H9etPv35OF', 'monthly');
      
      if (response.data.url) {
        // Store that this came from cookie consent for post-subscription handling
        localStorage.setItem('subscriptionSource', 'cookie-consent');
        window.location.href = response.data.url;
      } else {
        console.error('No checkout URL received');
        alert('Failed to start subscription process. Please try again.');
      }
    } catch (error) {
      console.error('Subscription checkout error:', error);
      alert('Failed to start subscription. Please try again.');
    } finally {
      setIsProcessingSubscription(false);
    }
  };

  const initializeTrackingScripts = (consent) => {
    // Initialize Google Analytics if analytics consent given
    if (consent.analytics && window.gtag) {
      window.gtag('consent', 'update', {
        'analytics_storage': 'granted',
        'ad_storage': consent.marketing ? 'granted' : 'denied',
        'ad_user_data': consent.marketing ? 'granted' : 'denied',
        'ad_personalization': consent.personalization ? 'granted' : 'denied'
      });
    }

    // Initialize other tracking scripts as needed
    if (consent.marketing) {
      // Initialize marketing pixels (Facebook, etc.)
      console.log('Marketing tracking enabled');
    }

    if (consent.personalization) {
      // Initialize personalization scripts
      console.log('Personalization tracking enabled');
    }
  };

  const togglePreference = (key) => {
    if (key === 'necessary') return; // Cannot disable necessary cookies
    
    setCookiePreferences(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="cookie-consent-backdrop" />
      
      {/* Main Banner */}
      <div className="cookie-consent-banner">
        <div className="cookie-consent-container">
          {!showDetails ? (
            // Main consent screen
            <div className="cookie-consent-main">
              <div className="cookie-consent-header">
                <div className="cookie-consent-icon">🍪</div>
                <h2>Your Privacy Matters</h2>
              </div>
              
              <div className="cookie-consent-content">
                <p>
                  We use cookies to enhance your experience, analyze site usage, and assist in our marketing efforts. 
                  You can accept all cookies, customize your preferences, or subscribe to our premium service for an 
                  ad-free, cookie-free experience.
                </p>
              </div>

              <div className="cookie-consent-options">
                {/* Subscription Option */}
                <div className="cookie-consent-subscription">
                  <div className="subscription-highlight">
                    <div className="subscription-badge">PREMIUM</div>
                    <h3>Go Ad-Free & Cookie-Free</h3>
                    <p>Subscribe for £0.99/month and enjoy:</p>
                    <ul>
                      <li>✓ Control your tracking preferences</li>
                      <li>✓ No advertisements</li>
                      <li>✓ Premium features</li>
                      <li>✓ Ad-free experience</li>
                    </ul>
                    <button 
                      className="btn-subscribe"
                      onClick={handleSubscribeForAdFree}
                      disabled={isProcessingSubscription}
                    >
                      {isProcessingSubscription ? 'Processing...' : 'Subscribe for £0.99/month'}
                    </button>
                  </div>
                </div>

                {/* Free Options */}
                <div className="cookie-consent-free-options">
                  <h4>Or continue with free access:</h4>
                  <div className="cookie-consent-buttons">
                    <button className="btn-accept-all" onClick={handleAcceptAll}>
                      Accept All Cookies
                    </button>
                    
                    <button className="btn-customize" onClick={handleCustomize}>
                      Customize Settings
                    </button>
                    
                    <button className="btn-reject" onClick={handleRejectAll}>
                      Reject Optional Cookies
                    </button>
                  </div>
                </div>
              </div>

              <div className="cookie-consent-footer">
                <p>
                  By continuing to use our site, you agree to our{' '}
                  <a href="/privacy-policy" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>{' '}
                  and{' '}
                  <a href="/terms-of-service" target="_blank" rel="noopener noreferrer">
                    Terms of Service
                  </a>.
                </p>
              </div>
            </div>
          ) : (
            // Detailed preferences screen
            <div className="cookie-consent-details">
              <div className="cookie-consent-header">
                <h2>Cookie Preferences</h2>
                <button 
                  className="btn-back"
                  onClick={() => setShowDetails(false)}
                  aria-label="Go back"
                >
                  ← Back
                </button>
              </div>

              <div className="cookie-preferences">
                <div className="cookie-category">
                  <div className="cookie-category-header">
                    <div className="cookie-toggle">
                      <input 
                        type="checkbox" 
                        id="necessary" 
                        checked={cookiePreferences.necessary}
                        disabled
                      />
                      <label htmlFor="necessary">
                        <strong>Necessary Cookies</strong>
                        <span className="required-badge">Required</span>
                      </label>
                    </div>
                  </div>
                  <p>These cookies are essential for the website to function properly and cannot be disabled.</p>
                </div>

                <div className="cookie-category">
                  <div className="cookie-category-header">
                    <div className="cookie-toggle">
                      <input 
                        type="checkbox" 
                        id="analytics" 
                        checked={cookiePreferences.analytics}
                        onChange={() => togglePreference('analytics')}
                      />
                      <label htmlFor="analytics">
                        <strong>Analytics Cookies</strong>
                      </label>
                    </div>
                  </div>
                  <p>Help us understand how visitors interact with our website by collecting and reporting information anonymously.</p>
                </div>

                <div className="cookie-category">
                  <div className="cookie-category-header">
                    <div className="cookie-toggle">
                      <input 
                        type="checkbox" 
                        id="marketing" 
                        checked={cookiePreferences.marketing}
                        onChange={() => togglePreference('marketing')}
                      />
                      <label htmlFor="marketing">
                        <strong>Marketing Cookies</strong>
                      </label>
                    </div>
                  </div>
                  <p>Used to track visitors across websites to display relevant advertisements and content.</p>
                </div>

                <div className="cookie-category">
                  <div className="cookie-category-header">
                    <div className="cookie-toggle">
                      <input 
                        type="checkbox" 
                        id="personalization" 
                        checked={cookiePreferences.personalization}
                        onChange={() => togglePreference('personalization')}
                      />
                      <label htmlFor="personalization">
                        <strong>Personalization Cookies</strong>
                      </label>
                    </div>
                  </div>
                  <p>Allow the website to remember your preferences and provide enhanced, personalized features.</p>
                </div>
              </div>

              <div className="cookie-consent-buttons">
                <button className="btn-save" onClick={handleSavePreferences}>
                  Save My Preferences
                </button>
                <button className="btn-accept-all" onClick={handleAcceptAll}>
                  Accept All
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default CookieConsentBanner;