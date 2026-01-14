// src/utils/cookieUtils.js
const COOKIE_CONSENT_KEY = 'tfp_cookie_consent';
const COOKIE_CONSENT_VERSION = '1.0';

/**
 * Save cookie consent preferences to localStorage
 */
export const saveCookieConsent = (consent) => {
  const consentData = {
    ...consent,
    version: COOKIE_CONSENT_VERSION,
    timestamp: new Date().toISOString()
  };
  
  localStorage.setItem(COOKIE_CONSENT_KEY, JSON.stringify(consentData));
  
  // Also set a simple cookie for server-side detection
  const consentCookie = `necessary=${consent.necessary}&analytics=${consent.analytics}&marketing=${consent.marketing}&personalization=${consent.personalization}`;
  document.cookie = `cookie_consent=${encodeURIComponent(consentCookie)}; path=/; max-age=${365 * 24 * 60 * 60}; secure; samesite=strict`;
  
  return consentData;
};

/**
 * Get cookie consent preferences from localStorage
 */
export const getCookieConsent = () => {
  try {
    const consentStr = localStorage.getItem(COOKIE_CONSENT_KEY);
    if (!consentStr) return null;
    
    const consent = JSON.parse(consentStr);
    
    // Check if consent is still valid (optional: expire after 1 year)
    if (consent.version !== COOKIE_CONSENT_VERSION) {
      // Version mismatch, require new consent
      clearCookieConsent();
      return null;
    }
    
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    if (consent.timestamp && new Date(consent.timestamp) < oneYearAgo) {
      // Consent expired, require new consent
      clearCookieConsent();
      return null;
    }
    
    return consent;
  } catch (error) {
    console.error('Error reading cookie consent:', error);
    return null;
  }
};

/**
 * Clear cookie consent (for testing or when consent expires)
 */
export const clearCookieConsent = () => {
  localStorage.removeItem(COOKIE_CONSENT_KEY);
  
  // Clear the consent cookie
  document.cookie = 'cookie_consent=; path=/; max-age=0';
};

/**
 * Check if specific cookie type is allowed
 */
export const isCookieTypeAllowed = (cookieType) => {
  const consent = getCookieConsent();
  if (!consent) return false;
  
  return consent[cookieType] === true;
};

/**
 * Get consent status for Google Analytics
 */
export const getGoogleAnalyticsConsent = () => {
  const consent = getCookieConsent();
  if (!consent) {
    return {
      'analytics_storage': 'denied',
      'ad_storage': 'denied',
      'ad_user_data': 'denied',
      'ad_personalization': 'denied'
    };
  }
  
  return {
    'analytics_storage': consent.analytics ? 'granted' : 'denied',
    'ad_storage': consent.marketing ? 'granted' : 'denied',
    'ad_user_data': consent.marketing ? 'granted' : 'denied',
    'ad_personalization': consent.personalization ? 'granted' : 'denied'
  };
};

/**
 * Initialize Google Analytics and AdSense with consent
 */
export const initializeGoogleAnalytics = (trackingId) => {
  if (!trackingId) return;
  
  // Load Google Analytics script
  const script1 = document.createElement('script');
  script1.async = true;
  script1.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
  document.head.appendChild(script1);
  
  // Initialize gtag
  const script2 = document.createElement('script');
  script2.innerHTML = `
    window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    
    // Set default consent for both Analytics and AdSense
    gtag('consent', 'default', {
      'analytics_storage': 'denied',
      'ad_storage': 'denied',
      'ad_user_data': 'denied', 
      'ad_personalization': 'denied',
      'wait_for_update': 500
    });
    
    gtag('config', '${trackingId}');
  `;
  document.head.appendChild(script2);
  
  // Update consent based on saved preferences
  const consent = getGoogleAnalyticsConsent();
  if (window.gtag) {
    window.gtag('consent', 'update', consent);
  }
};

/**
 * Update Google Analytics and AdSense consent
 */
export const updateGoogleAnalyticsConsent = () => {
  if (!window.gtag) return;
  
  const consent = getGoogleAnalyticsConsent();
  window.gtag('consent', 'update', consent);
};

/**
 * Initialize Facebook Pixel with consent
 */
export const initializeFacebookPixel = (pixelId) => {
  if (!pixelId || !isCookieTypeAllowed('marketing')) return;
  
  // Load Facebook Pixel using proper IIFE syntax
  (function(f,b,e,v,n,t,s) {
    if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s);
  })(window, document,'script', 'https://connect.facebook.net/en_US/fbevents.js');
  
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
};

/**
 * Initialize all tracking scripts based on consent
 */
export const initializeTracking = () => {
  const consent = getCookieConsent();
  if (!consent) return;
  
  // Initialize Google Analytics if consent given
  if (consent.analytics && process.env.REACT_APP_GA_TRACKING_ID) {
    initializeGoogleAnalytics(process.env.REACT_APP_GA_TRACKING_ID);
  }
  
  // Initialize Facebook Pixel if marketing consent given
  if (consent.marketing && process.env.REACT_APP_FB_PIXEL_ID) {
    initializeFacebookPixel(process.env.REACT_APP_FB_PIXEL_ID);
  }
  
  // Initialize other tracking scripts as needed
  console.log('Tracking initialized with consent:', consent);
};

/**
 * Track events with consent check
 */
export const trackEvent = (eventName, parameters = {}) => {
  const consent = getCookieConsent();
  
  // Only track if analytics consent given
  if (consent && consent.analytics && window.gtag) {
    window.gtag('event', eventName, parameters);
  }
  
  // Track marketing events if marketing consent given
  if (consent && consent.marketing && window.fbq) {
    window.fbq('track', eventName, parameters);
  }
};

/**
 * Check if user has active subscription (cookie-free experience)
 */
export const hasSubscriptionBasedConsent = () => {
  // This should integrate with your subscription context
  // For now, check localStorage for subscription info
  try {
    const subscriptionData = localStorage.getItem('subscription_status');
    if (subscriptionData) {
      const subscription = JSON.parse(subscriptionData);
      return subscription.hasActiveSubscription === true;
    }
    
    // Also check if we have subscription info in the page context
    if (window.__SUBSCRIPTION_STATUS__) {
      return window.__SUBSCRIPTION_STATUS__.hasActiveSubscription === true;
    }
  } catch (error) {
    console.error('Error checking subscription status:', error);
  }
  
  return false;
};

/**
 * Initialize tracking on page load based on consent and subscription
 */
export const initializePageTracking = () => {
  // Don't initialize tracking if user has active subscription
  if (hasSubscriptionBasedConsent()) {
    console.log('🔒 Premium user - tracking disabled');
    return;
  }
  
  // Initialize tracking based on consent
  initializeTracking();
};

const cookieUtils = {
  saveCookieConsent,
  getCookieConsent,
  clearCookieConsent,
  isCookieTypeAllowed,
  getGoogleAnalyticsConsent,
  initializeGoogleAnalytics,
  updateGoogleAnalyticsConsent,
  initializeFacebookPixel,
  initializeTracking,
  trackEvent,
  hasSubscriptionBasedConsent,
  initializePageTracking
};

export default cookieUtils;