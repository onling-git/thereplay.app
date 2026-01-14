// Backend API routes for cookie consent
// backend/routes/privacyRoutes.js
const express = require('express');
const { protect } = require('../middleware/auth');
const { cookieConsentMiddleware, getPrivacyStatus } = require('../middleware/cookieConsent');
const catchAsync = require('../utils/catchAsync');
const User = require('../models/User');

const router = express.Router();

// Apply cookie consent middleware to all routes
router.use(cookieConsentMiddleware);

// Get privacy status (public endpoint)
router.get('/privacy-status', catchAsync(async (req, res, next) => {
  const privacyStatus = getPrivacyStatus(req);
  
  res.status(200).json({
    status: 'success',
    data: privacyStatus
  });
}));

// Get user's privacy settings (protected endpoint)
router.get('/privacy-settings', protect, catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('privacy_settings');
  
  res.status(200).json({
    status: 'success',
    data: {
      privacy_settings: user.privacy_settings || {}
    }
  });
}));

// Update user's privacy settings (protected endpoint)
router.patch('/privacy-settings', protect, catchAsync(async (req, res, next) => {
  const { cookie_consent, email_preferences, data_processing } = req.body;
  
  const updateData = {};
  
  if (cookie_consent) {
    updateData['privacy_settings.cookie_consent'] = {
      ...cookie_consent,
      updated_at: new Date()
    };
  }
  
  if (email_preferences) {
    updateData['privacy_settings.email_preferences'] = email_preferences;
  }
  
  if (data_processing) {
    updateData['privacy_settings.data_processing'] = data_processing;
  }
  
  const user = await User.findByIdAndUpdate(
    req.user.id,
    { $set: updateData },
    { new: true, runValidators: true }
  ).select('privacy_settings');
  
  res.status(200).json({
    status: 'success',
    message: 'Privacy settings updated successfully',
    data: {
      privacy_settings: user.privacy_settings
    }
  });
}));

// Delete user's privacy data (GDPR compliance)
router.delete('/delete-privacy-data', protect, catchAsync(async (req, res, next) => {
  const { confirm } = req.body;
  
  if (confirm !== 'DELETE') {
    return res.status(400).json({
      status: 'fail',
      message: 'Please confirm deletion by sending "confirm": "DELETE"'
    });
  }
  
  // Reset privacy settings to defaults
  await User.findByIdAndUpdate(req.user.id, {
    $set: {
      'privacy_settings.cookie_consent': {
        necessary: true,
        analytics: false,
        marketing: false,
        personalization: false,
        updated_at: new Date(),
        method: 'reset'
      },
      'privacy_settings.email_preferences': {
        marketing_emails: false,
        product_updates: true,
        security_alerts: true
      },
      'privacy_settings.data_processing': {
        allow_profiling: false,
        allow_third_party_sharing: false
      }
    }
  });
  
  res.status(200).json({
    status: 'success',
    message: 'Privacy data reset successfully'
  });
}));

// Export user's privacy data (GDPR compliance)
router.get('/export-privacy-data', protect, catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('privacy_settings billing_history created_at email first_name surname');
  
  const privacyExport = {
    user_info: {
      email: user.email,
      first_name: user.first_name,
      surname: user.surname,
      created_at: user.created_at
    },
    privacy_settings: user.privacy_settings,
    billing_history: user.billing_history,
    export_date: new Date().toISOString()
  };
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="privacy-data-export.json"');
  
  res.status(200).json({
    status: 'success',
    data: privacyExport
  });
}));

module.exports = router;