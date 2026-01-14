// Backend middleware to track cookie consent
// backend/middleware/cookieConsent.js
const catchAsync = require('../utils/catchAsync');
const User = require('../models/User');

const parseCookieConsent = (consentString) => {
  try {
    const params = new URLSearchParams(consentString);
    return {
      necessary: params.get('necessary') === 'true',
      analytics: params.get('analytics') === 'true',
      marketing: params.get('marketing') === 'true',
      personalization: params.get('personalization') === 'true'
    };
  } catch (error) {
    return null;
  }
};

const cookieConsentMiddleware = catchAsync(async (req, res, next) => {
  // Extract cookie consent from cookies
  const consentCookie = req.cookies?.cookie_consent;
  
  if (consentCookie) {
    const consent = parseCookieConsent(consentCookie);
    req.cookieConsent = consent;
    
    // If user is authenticated, save consent to their profile
    if (req.user && consent) {
      try {
        await User.findByIdAndUpdate(req.user.id, {
          'privacy_settings.cookie_consent': {
            ...consent,
            updated_at: new Date()
          }
        });
      } catch (error) {
        console.error('Failed to save cookie consent to user profile:', error);
      }
    }
  } else {
    req.cookieConsent = null;
  }
  
  next();
});

// Helper function to check if analytics are allowed
const isAnalyticsAllowed = (req) => {
  // Check if user has active subscription (premium users get cookie-free experience)
  if (req.user?.subscription?.status === 'active') {
    return false; // No tracking for premium users
  }
  
  // Check cookie consent
  if (req.cookieConsent) {
    return req.cookieConsent.analytics === true;
  }
  
  return false; // Default to no tracking
};

// Helper function to check if marketing cookies are allowed
const isMarketingAllowed = (req) => {
  // Check if user has active subscription
  if (req.user?.subscription?.status === 'active') {
    return false; // No marketing tracking for premium users
  }
  
  // Check cookie consent
  if (req.cookieConsent) {
    return req.cookieConsent.marketing === true;
  }
  
  return false; // Default to no marketing tracking
};

// Helper function to get user's privacy status
const getPrivacyStatus = (req) => {
  const hasActiveSubscription = req.user?.subscription?.status === 'active';
  
  return {
    hasActiveSubscription,
    cookieConsent: req.cookieConsent,
    analyticsAllowed: isAnalyticsAllowed(req),
    marketingAllowed: isMarketingAllowed(req),
    personalizationAllowed: req.cookieConsent?.personalization || false
  };
};

module.exports = {
  cookieConsentMiddleware,
  isAnalyticsAllowed,
  isMarketingAllowed,
  getPrivacyStatus
};