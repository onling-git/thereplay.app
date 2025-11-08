const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');

// Payment Method Schema
const PaymentMethodSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    default: () => crypto.randomUUID()
  },
  type: {
    type: String,
    enum: ['card', 'paypal', 'bank_transfer', 'apple_pay', 'google_pay'],
    required: true
  },
  // For cards
  last_four: String,
  brand: String, // visa, mastercard, amex, etc.
  exp_month: Number,
  exp_year: Number,
  
  // For PayPal
  paypal_email: String,
  
  // For bank transfers
  bank_name: String,
  account_ending: String,
  
  // Common fields
  nickname: String, // User-friendly name like "Work Card", "Personal PayPal"
  is_default: {
    type: Boolean,
    default: false
  },
  is_active: {
    type: Boolean,
    default: true
  },
  
  // External payment processor IDs (Stripe, PayPal, etc.)
  external_id: String,
  processor: {
    type: String,
    enum: ['stripe', 'paypal', 'square', 'other']
  },
  
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Billing History Schema
const BillingHistorySchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    default: () => crypto.randomUUID()
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  description: String,
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'cancelled', 'refunded', 'disputed'],
    required: true
  },
  payment_method_id: String, // Reference to payment method used
  transaction_id: String, // External processor transaction ID
  invoice_id: String,
  
  // Subscription related
  subscription_period_start: Date,
  subscription_period_end: Date,
  
  // Dates
  attempted_at: Date,
  completed_at: Date,
  
  // Failure information
  failure_reason: String,
  failure_code: String,
  
  // Refund information
  refunded_at: Date,
  refund_amount: Number,
  refund_reason: String,
  
  created_at: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

// Subscription Schema
const SubscriptionSchema = new mongoose.Schema({
  plan: {
    type: String,
    enum: ['free', 'basic', 'premium', 'pro', 'enterprise'],
    default: 'free'
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'past_due', 'unpaid', 'trialing'],
    default: 'inactive'
  },
  
  // Dates
  started_at: Date,
  current_period_start: Date,
  current_period_end: Date,
  trial_start: Date,
  trial_end: Date,
  cancelled_at: Date,
  ended_at: Date,
  
  // Pricing
  amount: Number, // Monthly/yearly amount
  currency: {
    type: String,
    default: 'USD',
    uppercase: true
  },
  interval: {
    type: String,
    enum: ['month', 'year'],
    default: 'month'
  },
  
  // External subscription IDs
  external_subscription_id: String,
  processor: {
    type: String,
    enum: ['stripe', 'paypal', 'square', 'other']
  },
  
  // Features
  features: {
    live_scores: {
      type: Boolean,
      default: true
    },
    premium_stats: {
      type: Boolean,
      default: false
    },
    multiple_teams: {
      type: Boolean,
      default: false
    },
    ad_free: {
      type: Boolean,
      default: false
    },
    push_notifications: {
      type: Boolean,
      default: false
    },
    exclusive_content: {
      type: Boolean,
      default: false
    },
    api_access: {
      type: Boolean,
      default: false
    }
  }
}, { _id: false });

// User Preferences Schema
const UserPreferencesSchema = new mongoose.Schema({
  // Notification preferences
  notifications: {
    email: {
      match_alerts: { type: Boolean, default: true },
      score_updates: { type: Boolean, default: true },
      team_news: { type: Boolean, default: false },
      weekly_digest: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    },
    push: {
      match_alerts: { type: Boolean, default: true },
      score_updates: { type: Boolean, default: true },
      team_news: { type: Boolean, default: false }
    },
    sms: {
      match_alerts: { type: Boolean, default: false },
      score_updates: { type: Boolean, default: false }
    }
  },
  
  // Display preferences
  display: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    language: {
      type: String,
      default: 'en'
    },
    timezone: String,
    date_format: {
      type: String,
      enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'],
      default: 'DD/MM/YYYY'
    },
    time_format: {
      type: String,
      enum: ['12h', '24h'],
      default: '24h'
    }
  },
  
  // Privacy preferences
  privacy: {
    profile_visibility: {
      type: String,
      enum: ['public', 'friends', 'private'],
      default: 'private'
    },
    show_favourite_team: { type: Boolean, default: true },
    allow_friend_requests: { type: Boolean, default: true },
    analytics_tracking: { type: Boolean, default: true }
  }
}, { _id: false });

// Main User Schema
const userSchema = new mongoose.Schema({
  // Basic Information
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    validate: [validator.isEmail, 'Please provide a valid email']
  },
  
  first_name: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  
  surname: {
    type: String,
    required: true,
    trim: true,
    maxlength: [50, 'Surname cannot exceed 50 characters']
  },
  
  // Optional display name (if different from first_name + surname)
  display_name: {
    type: String,
    trim: true,
    maxlength: [100, 'Display name cannot exceed 100 characters']
  },
  
  // Authentication
  password: {
    type: String,
    required: true,
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false // Don't include password in queries by default
  },
  
  // Account status
  is_active: {
    type: Boolean,
    default: true
  },
  
  is_verified: {
    type: Boolean,
    default: false
  },
  
  // Email verification
  email_verification_token: String,
  email_verification_expires: Date,
  
  // Password reset
  password_reset_token: String,
  password_reset_expires: Date,
  password_changed_at: Date,
  
  // Team preferences
  favourite_team: {
    type: Number, // Sportmonks team ID
    ref: 'Team',
    index: true
  },
  
  followed_teams: [{
    type: Number, // Array of Sportmonks team IDs
    ref: 'Team'
  }],
  
  // Subscription information
  subscription: {
    type: SubscriptionSchema,
    default: () => ({
      plan: 'free',
      status: 'inactive',
      features: {
        live_scores: true,
        premium_stats: false,
        multiple_teams: false,
        ad_free: false,
        push_notifications: false,
        exclusive_content: false,
        api_access: false
      }
    })
  },
  
  // Payment information
  payment_methods: [PaymentMethodSchema],
  billing_history: [BillingHistorySchema],
  
  // Stripe integration fields
  stripe_customer_id: {
    type: String,
    index: true
  },
  stripe_subscription_id: {
    type: String,
    index: true
  },
  
  // User preferences
  preferences: {
    type: UserPreferencesSchema,
    default: () => ({})
  },
  
  // Additional contact information
  phone: {
    type: String,
    validate: {
      validator: function(v) {
        return !v || validator.isMobilePhone(v);
      },
      message: 'Please provide a valid phone number'
    }
  },
  
  // Location (optional)
  country: String,
  city: String,
  timezone: String,
  
  // Usage tracking
  last_login: Date,
  login_count: {
    type: Number,
    default: 0
  },
  
  // Social features (for future use)
  avatar_url: String,
  bio: {
    type: String,
    maxlength: [500, 'Bio cannot exceed 500 characters']
  },
  
  // Marketing and communication
  marketing_consent: {
    type: Boolean,
    default: false
  },
  
  communication_consent: {
    type: Boolean,
    default: true
  },
  
  // Terms and conditions
  terms_accepted_at: Date,
  privacy_policy_accepted_at: Date,
  
  // Admin fields
  role: {
    type: String,
    enum: ['user', 'moderator', 'admin', 'super_admin'],
    default: 'user'
  },
  
  notes: String, // Internal admin notes
  
  // Soft delete
  deleted_at: Date,
  
  // API usage (for future API access)
  api_key: String,
  api_requests_count: {
    type: Number,
    default: 0
  },
  api_rate_limit_reset: Date

}, {
  timestamps: true,
  // Include virtuals in JSON output
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
userSchema.index({ email: 1 });
userSchema.index({ favourite_team: 1 });
userSchema.index({ followed_teams: 1 });
userSchema.index({ 'subscription.status': 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ last_login: -1 });
userSchema.index({ created_at: -1 });
userSchema.index({ is_active: 1, is_verified: 1 });

// Virtual for full name
userSchema.virtual('full_name').get(function() {
  return `${this.first_name} ${this.surname}`;
});

// Virtual for checking if user is subscribed
userSchema.virtual('is_subscribed').get(function() {
  return this.subscription && 
         this.subscription.status === 'active' && 
         this.subscription.plan !== 'free';
});

// Virtual for checking if subscription is active
userSchema.virtual('subscription_active').get(function() {
  if (!this.subscription) return false;
  
  const now = new Date();
  return this.subscription.status === 'active' &&
         (!this.subscription.current_period_end || this.subscription.current_period_end > now);
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash the password if it's been modified (or is new)
  if (!this.isModified('password')) return next();
  
  // Hash the password with cost of 12
  this.password = await bcrypt.hash(this.password, 12);
  
  // Set password changed timestamp
  this.password_changed_at = new Date();
  
  next();
});

// Pre-save middleware to ensure only one default payment method
userSchema.pre('save', function(next) {
  if (this.isModified('payment_methods')) {
    const defaultMethods = this.payment_methods.filter(method => method.is_default);
    
    if (defaultMethods.length > 1) {
      // Keep only the first default method
      this.payment_methods.forEach((method, index) => {
        if (index > 0 && method.is_default) {
          method.is_default = false;
        }
      });
    }
  }
  
  next();
});

// Instance method to check password
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Instance method to check if password was changed after JWT was issued
userSchema.methods.changedPasswordAfter = function(JWTTimestamp) {
  if (this.password_changed_at) {
    const changedTimestamp = parseInt(this.password_changed_at.getTime() / 1000, 10);
    return JWTTimestamp < changedTimestamp;
  }
  
  return false;
};

// Instance method to create password reset token
userSchema.methods.createPasswordResetToken = function() {
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  this.password_reset_token = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.password_reset_expires = Date.now() + 10 * 60 * 1000; // 10 minutes
  
  return resetToken;
};

// Instance method to create email verification token
userSchema.methods.createEmailVerificationToken = function() {
  const verificationToken = crypto.randomBytes(32).toString('hex');
  
  this.email_verification_token = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');
  
  this.email_verification_expires = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
  
  return verificationToken;
};

// Instance method to add payment method
userSchema.methods.addPaymentMethod = function(paymentMethodData) {
  // If this is the first payment method or explicitly set as default
  if (this.payment_methods.length === 0 || paymentMethodData.is_default) {
    // Remove default from other methods
    this.payment_methods.forEach(method => {
      method.is_default = false;
    });
    paymentMethodData.is_default = true;
  }
  
  this.payment_methods.push(paymentMethodData);
  return this.save();
};

// Instance method to add billing history entry
userSchema.methods.addBillingEntry = function(billingData) {
  this.billing_history.push(billingData);
  
  // Keep only last 100 billing entries to prevent document size issues
  if (this.billing_history.length > 100) {
    this.billing_history = this.billing_history.slice(-100);
  }
  
  return this.save();
};

// Instance method to update subscription
userSchema.methods.updateSubscription = function(subscriptionData) {
  this.subscription = { ...this.subscription.toObject(), ...subscriptionData };
  return this.save();
};

// Static method to find users by team preference
userSchema.statics.findByFavouriteTeam = function(teamId) {
  return this.find({ favourite_team: teamId, is_active: true });
};

// Static method to find users following a team
userSchema.statics.findFollowersOfTeam = function(teamId) {
  return this.find({ followed_teams: teamId, is_active: true });
};

// Static method to find subscribed users
userSchema.statics.findSubscribedUsers = function() {
  return this.find({
    'subscription.status': 'active',
    'subscription.plan': { $ne: 'free' },
    is_active: true
  });
};

module.exports = mongoose.model('User', userSchema);
