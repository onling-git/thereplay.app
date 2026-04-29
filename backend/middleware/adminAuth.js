// middleware/adminAuth.js
const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');

// Helper function for handling async errors
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Middleware that accepts either API key or admin user authentication
module.exports = function adminAuth(requireForAll = true) {
  return catchAsync(async (req, res, next) => {
    // Check for API key first
    const apiKey = req.header('x-api-key') || req.query.api_key;
    if (apiKey && apiKey === process.env.ADMIN_API_KEY) {
      return next();
    }

    // If no valid API key, check for user authentication
    let token;
    
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    } else if (req.cookies && req.cookies.jwt) {
      token = req.cookies.jwt;
    }

    if (!token) {
      if (requireForAll) {
        return res.status(401).json({ error: 'API key or admin authentication required' });
      }
      return next();
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
    } catch (error) {
      if (requireForAll) {
        return res.status(401).json({ error: 'Invalid token' });
      }
      return next();
    }

    // Check if user exists and is active
    const currentUser = await User.findById(decoded.id);
    if (!currentUser || !currentUser.is_active) {
      if (requireForAll) {
        return res.status(401).json({ error: 'User not found or inactive' });
      }
      return next();
    }

    // Check if user has admin role
    if (!['admin', 'super_admin'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    // Check if user changed password after token was issued
    if (currentUser.changedPasswordAfter(decoded.iat)) {
      if (requireForAll) {
        return res.status(401).json({ error: 'User recently changed password! Please log in again.' });
      }
      return next();
    }

    // Grant access
    req.user = currentUser;
    next();
  });
};