const jwt = require('jsonwebtoken');
const { promisify } = require('util');
const User = require('../models/User');

// Helper function for handling async errors
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Middleware to protect routes (authentication required)
exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      status: 'fail',
      message: 'You are not logged in! Please log in to get access.'
    });
  }

  // 2) Verification token
  let decoded;
  try {
    decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Invalid token. Please log in again!'
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'fail',
        message: 'Your token has expired! Please log in again.'
      });
    }
    throw error;
  }

  // 3) Check if user still exists
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return res.status(401).json({
      status: 'fail',
      message: 'The user belonging to this token does no longer exist.'
    });
  }

  // 4) Check if user is active
  if (!currentUser.is_active) {
    return res.status(401).json({
      status: 'fail',
      message: 'Your account has been deactivated. Please contact support.'
    });
  }

  // 5) Check if user changed password after the token was issued
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return res.status(401).json({
      status: 'fail',
      message: 'User recently changed password! Please log in again.'
    });
  }

  // Grant access to protected route
  req.user = currentUser;
  next();
});

// Middleware for optional authentication (doesn't require login)
// This allows routes to work for both authenticated and anonymous users
exports.optionalAuth = catchAsync(async (req, res, next) => {
  // 1) Getting token if it exists
  let token;
  
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.cookies && req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  // If no token, continue as anonymous user
  if (!token || token === 'loggedout') {
    req.user = null;
    return next();
  }

  try {
    // 2) Verification token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // 3) Check if user still exists
    const currentUser = await User.findById(decoded.id);
    
    // 4) Check if user is active and password hasn't changed
    if (currentUser && 
        currentUser.is_active && 
        !currentUser.changedPasswordAfter(decoded.iat)) {
      req.user = currentUser;
    } else {
      req.user = null;
    }
  } catch (error) {
    // If token is invalid, continue as anonymous user
    req.user = null;
  }

  next();
});

// Middleware to restrict to certain roles
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'fail',
        message: 'You are not logged in! Please log in to get access.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'fail',
        message: 'You do not have permission to perform this action'
      });
    }

    next();
  };
};

// Middleware to check if user is verified
exports.requireVerification = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'fail',
      message: 'You are not logged in! Please log in to get access.'
    });
  }

  if (!req.user.is_verified) {
    return res.status(403).json({
      status: 'fail',
      message: 'Please verify your email address to access this feature.',
      action_required: 'email_verification'
    });
  }

  next();
};

// Middleware to check subscription status
exports.requireSubscription = (planLevel = 'basic') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'fail',
        message: 'You are not logged in! Please log in to get access.'
      });
    }

    const planHierarchy = {
      'free': 0,
      'basic': 1,
      'premium': 2,
      'pro': 3,
      'enterprise': 4
    };

    const userPlanLevel = planHierarchy[req.user.subscription?.plan] || 0;
    const requiredPlanLevel = planHierarchy[planLevel] || 1;

    if (userPlanLevel < requiredPlanLevel || 
        req.user.subscription?.status !== 'active') {
      return res.status(403).json({
        status: 'fail',
        message: `This feature requires a ${planLevel} subscription or higher.`,
        action_required: 'subscription_upgrade',
        current_plan: req.user.subscription?.plan || 'free',
        required_plan: planLevel
      });
    }

    next();
  };
};

// Middleware to check if user has accepted latest terms
exports.requireTermsAcceptance = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'fail',
      message: 'You are not logged in! Please log in to get access.'
    });
  }

  // You can implement logic to check if terms were updated after user acceptance
  if (!req.user.terms_accepted_at) {
    return res.status(403).json({
      status: 'fail',
      message: 'Please accept the terms and conditions to continue.',
      action_required: 'terms_acceptance'
    });
  }

  next();
};

// Middleware to log user activity (for analytics)
exports.logActivity = (action) => {
  return (req, res, next) => {
    // Store activity information in request for logging
    req.userActivity = {
      action,
      timestamp: new Date(),
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id || null,
      isAuthenticated: !!req.user
    };

    // You can implement actual logging here
    // For example, save to database, send to analytics service, etc.
    
    next();
  };
};

// Middleware to handle rate limiting per user
exports.userRateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const userRequests = new Map();

  return (req, res, next) => {
    const userId = req.user?.id || req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    if (userRequests.has(userId)) {
      const requests = userRequests.get(userId).filter(time => time > windowStart);
      userRequests.set(userId, requests);
    }

    // Get current request count
    const currentRequests = userRequests.get(userId) || [];
    
    if (currentRequests.length >= maxRequests) {
      return res.status(429).json({
        status: 'fail',
        message: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }

    // Add current request
    currentRequests.push(now);
    userRequests.set(userId, currentRequests);

    next();
  };
};

// Middleware to ensure user owns resource (for user-specific data)
exports.ensureOwnership = (resourceField = 'user') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'fail',
        message: 'You are not logged in! Please log in to get access.'
      });
    }

    // This middleware should be used after the resource is loaded
    // The resource should be available in req.resource or similar
    const resource = req.resource || req.body;
    
    if (resource && resource[resourceField] && 
        resource[resourceField].toString() !== req.user.id.toString()) {
      return res.status(403).json({
        status: 'fail',
        message: 'You can only access your own resources.'
      });
    }

    next();
  };
};

module.exports = exports;