const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { promisify } = require('util');

// Helper function to sign JWT token
const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '90d'
  });
};

// Helper function to create and send token
const createSendToken = (user, statusCode, res, message = 'Success') => {
  const token = signToken(user._id);
  
  const cookieOptions = {
    expires: new Date(
      Date.now() + (process.env.JWT_COOKIE_EXPIRES_IN || 90) * 24 * 60 * 60 * 1000
    ),
    httpOnly: false, // Set to false for development to allow cross-origin
    secure: false, // Set to false for development (localhost)
    sameSite: 'lax' // Use lax for development
  };

  res.cookie('jwt', token, cookieOptions);

  // Remove password from output
  user.password = undefined;

  res.status(statusCode).json({
    status: 'success',
    message,
    token,
    data: {
      user
    }
  });
};

// Helper function for handling async errors
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

// Register new user
exports.register = catchAsync(async (req, res, next) => {
  const {
    email,
    first_name,
    surname,
    password,
    favourite_team,
    phone,
    country,
    marketing_consent,
    terms_accepted
  } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({
      status: 'fail',
      message: 'User with this email already exists'
    });
  }

  // Create new user
  const newUser = await User.create({
    email: email.toLowerCase(),
    first_name,
    surname,
    password,
    favourite_team,
    phone,
    country,
    marketing_consent: marketing_consent || false,
    communication_consent: true,
    terms_accepted_at: terms_accepted ? new Date() : undefined,
    privacy_policy_accepted_at: terms_accepted ? new Date() : undefined
  });

  // Generate email verification token
  const verifyToken = newUser.createEmailVerificationToken();
  await newUser.save({ validateBeforeSave: false });

  // TODO: Send verification email
  // await sendVerificationEmail(newUser.email, verifyToken);

  createSendToken(newUser, 201, res, 'User registered successfully. Please check your email to verify your account.');
});

// Login user
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password exist
  if (!email || !password) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide email and password'
    });
  }

  // Check if user exists and password is correct
  const user = await User.findOne({ email: email.toLowerCase(), is_active: true })
    .select('+password');

  if (!user || !(await user.correctPassword(password, user.password))) {
    return res.status(401).json({
      status: 'fail',
      message: 'Incorrect email or password'
    });
  }

  // Update login statistics
  user.last_login = new Date();
  user.login_count += 1;
  await user.save({ validateBeforeSave: false });

  createSendToken(user, 200, res, 'Logged in successfully');
});

// Logout user
exports.logout = (req, res) => {
  res.cookie('jwt', 'loggedout', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: false, // Set to false for development
    secure: false, // Set to false for development
    sameSite: 'lax'
  });
  
  res.status(200).json({
    status: 'success',
    message: 'Logged out successfully'
  });
};

// Get current user profile
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).populate('favourite_team followed_teams');
  
  res.status(200).json({
    status: 'success',
    data: {
      user
    }
  });
});

// Update current user profile
exports.updateMe = catchAsync(async (req, res, next) => {
  // Create error if user POSTs password data
  if (req.body.password || req.body.passwordConfirm) {
    return res.status(400).json({
      status: 'fail',
      message: 'This route is not for password updates. Please use /change-password'
    });
  }

  // Filter out unwanted field names that are not allowed to be updated
  const allowedFields = [
    'first_name', 'surname', 'display_name', 'phone', 'country', 'city', 
    'timezone', 'bio', 'marketing_consent', 'communication_consent',
    'preferences'
  ];
  
  const filteredBody = {};
  Object.keys(req.body).forEach(el => {
    if (allowedFields.includes(el)) filteredBody[el] = req.body[el];
  });

  // Update user document
  const updatedUser = await User.findByIdAndUpdate(req.user.id, filteredBody, {
    new: true,
    runValidators: true
  });

  res.status(200).json({
    status: 'success',
    message: 'Profile updated successfully',
    data: {
      user: updatedUser
    }
  });
});

// Change password
exports.changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword, confirmPassword } = req.body;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide current password, new password, and confirm password'
    });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({
      status: 'fail',
      message: 'New password and confirm password do not match'
    });
  }

  // Get user from collection
  const user = await User.findById(req.user.id).select('+password');

  // Check if POSTed current password is correct
  if (!(await user.correctPassword(currentPassword, user.password))) {
    return res.status(401).json({
      status: 'fail',
      message: 'Current password is incorrect'
    });
  }

  // Update password
  user.password = newPassword;
  await user.save();

  // Log user in, send JWT
  createSendToken(user, 200, res, 'Password changed successfully');
});

// Forgot password
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide your email address'
    });
  }

  // Get user based on POSTed email
  const user = await User.findOne({ email: email.toLowerCase(), is_active: true });
  
  if (!user) {
    return res.status(404).json({
      status: 'fail',
      message: 'There is no user with that email address'
    });
  }

  // Generate the random reset token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // TODO: Send password reset email
  // await sendPasswordResetEmail(user.email, resetToken);

  res.status(200).json({
    status: 'success',
    message: 'Password reset token sent to email!'
  });
});

// Reset password
exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token, password, confirmPassword } = req.body;

  if (!token || !password || !confirmPassword) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide token, password, and confirm password'
    });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({
      status: 'fail',
      message: 'Password and confirm password do not match'
    });
  }

  // Get user based on the token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    password_reset_token: hashedToken,
    password_reset_expires: { $gt: Date.now() },
    is_active: true
  });

  // If token has not expired, and there is user, set the new password
  if (!user) {
    return res.status(400).json({
      status: 'fail',
      message: 'Token is invalid or has expired'
    });
  }

  user.password = password;
  user.password_reset_token = undefined;
  user.password_reset_expires = undefined;
  await user.save();

  // Update changedPasswordAt property is handled in pre-save middleware

  // Log the user in, send JWT
  createSendToken(user, 200, res, 'Password reset successfully');
});

// Verify email
exports.verifyEmail = catchAsync(async (req, res, next) => {
  const { token } = req.params;

  // Get user based on the token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

  const user = await User.findOne({
    email_verification_token: hashedToken,
    email_verification_expires: { $gt: Date.now() },
    is_active: true
  });

  if (!user) {
    return res.status(400).json({
      status: 'fail',
      message: 'Token is invalid or has expired'
    });
  }

  // Update user as verified
  user.is_verified = true;
  user.email_verification_token = undefined;
  user.email_verification_expires = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully'
  });
});

// Update team preferences
exports.updateTeamPreferences = catchAsync(async (req, res, next) => {
  const { favourite_team, followed_teams } = req.body;
  
  const updateData = {};
  if (favourite_team !== undefined) updateData.favourite_team = favourite_team;
  if (followed_teams !== undefined) updateData.followed_teams = followed_teams;

  const user = await User.findByIdAndUpdate(
    req.user.id,
    updateData,
    { new: true, runValidators: true }
  ).populate('favourite_team followed_teams');

  res.status(200).json({
    status: 'success',
    message: 'Team preferences updated successfully',
    data: {
      user
    }
  });
});

// Get team preferences (works for both authenticated and anonymous users)
exports.getTeamPreferences = catchAsync(async (req, res, next) => {
  let teamPreferences = {
    favourite_team: null,
    followed_teams: []
  };

  // If user is authenticated, get their preferences
  if (req.user) {
    const user = await User.findById(req.user.id)
      .select('favourite_team followed_teams')
      .populate('favourite_team followed_teams');
    
    teamPreferences = {
      favourite_team: user.favourite_team,
      followed_teams: user.followed_teams
    };
  } else {
    // For anonymous users, check if they have preferences in session/cookies
    if (req.session && req.session.teamPreferences) {
      teamPreferences = req.session.teamPreferences;
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      team_preferences: teamPreferences,
      is_authenticated: !!req.user
    }
  });
});

// Set team preferences for anonymous users (using session/cookies)
exports.setAnonymousTeamPreferences = catchAsync(async (req, res, next) => {
  const { favourite_team, followed_teams } = req.body;
  
  // Initialize session if it doesn't exist
  if (!req.session) {
    req.session = {};
  }
  
  // Store in session
  req.session.teamPreferences = {
    favourite_team: favourite_team || null,
    followed_teams: followed_teams || []
  };

  res.status(200).json({
    status: 'success',
    message: 'Team preferences saved for this session',
    data: {
      team_preferences: req.session.teamPreferences,
      is_authenticated: false,
      note: 'Preferences will be lost when you close your browser. Create an account to save permanently.'
    }
  });
});

// Payment Methods
exports.addPaymentMethod = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  await user.addPaymentMethod(req.body);

  res.status(201).json({
    status: 'success',
    message: 'Payment method added successfully',
    data: {
      payment_methods: user.payment_methods
    }
  });
});

exports.getPaymentMethods = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('payment_methods');

  res.status(200).json({
    status: 'success',
    data: {
      payment_methods: user.payment_methods.filter(method => method.is_active)
    }
  });
});

exports.updatePaymentMethod = catchAsync(async (req, res, next) => {
  const { methodId } = req.params;
  const user = await User.findById(req.user.id);
  
  const method = user.payment_methods.id(methodId);
  if (!method) {
    return res.status(404).json({
      status: 'fail',
      message: 'Payment method not found'
    });
  }

  // Update method properties
  Object.keys(req.body).forEach(key => {
    if (key !== 'id') {
      method[key] = req.body[key];
    }
  });

  method.updated_at = new Date();
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Payment method updated successfully',
    data: {
      payment_method: method
    }
  });
});

exports.deletePaymentMethod = catchAsync(async (req, res, next) => {
  const { methodId } = req.params;
  const user = await User.findById(req.user.id);
  
  const method = user.payment_methods.id(methodId);
  if (!method) {
    return res.status(404).json({
      status: 'fail',
      message: 'Payment method not found'
    });
  }

  method.is_active = false;
  await user.save();

  res.status(200).json({
    status: 'success',
    message: 'Payment method deleted successfully'
  });
});

// Billing History
exports.getBillingHistory = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('billing_history');
  
  // Sort by creation date, newest first
  const sortedHistory = user.billing_history.sort((a, b) => 
    new Date(b.created_at) - new Date(a.created_at)
  );

  res.status(200).json({
    status: 'success',
    data: {
      billing_history: sortedHistory
    }
  });
});

// Subscription Management
exports.updateSubscription = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id);
  
  await user.updateSubscription(req.body);

  res.status(200).json({
    status: 'success',
    message: 'Subscription updated successfully',
    data: {
      subscription: user.subscription
    }
  });
});

exports.getSubscription = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user.id).select('subscription');

  res.status(200).json({
    status: 'success',
    data: {
      subscription: user.subscription
    }
  });
});

// Delete account
exports.deleteAccount = catchAsync(async (req, res, next) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      status: 'fail',
      message: 'Please provide your password to confirm account deletion'
    });
  }

  // Get user with password
  const user = await User.findById(req.user.id).select('+password');

  // Check password
  if (!(await user.correctPassword(password, user.password))) {
    return res.status(401).json({
      status: 'fail',
      message: 'Incorrect password'
    });
  }

  // Soft delete - set deleted_at timestamp and deactivate
  user.deleted_at = new Date();
  user.is_active = false;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Account deleted successfully'
  });
});

// Admin: Get all users
exports.getAllUsers = catchAsync(async (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const skip = (page - 1) * limit;

  const query = User.find({ deleted_at: { $exists: false } });
  
  // Apply filters
  if (req.query.verified) {
    query.where('is_verified').equals(req.query.verified === 'true');
  }
  
  if (req.query.subscribed) {
    query.where('subscription.status').equals('active');
  }

  const users = await query
    .skip(skip)
    .limit(limit)
    .sort({ created_at: -1 });

  const total = await User.countDocuments({ deleted_at: { $exists: false } });

  res.status(200).json({
    status: 'success',
    results: users.length,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    },
    data: {
      users
    }
  });
});

module.exports = exports;