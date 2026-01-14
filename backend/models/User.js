const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const validator = require('validator');
const crypto = require('crypto');

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
    ref: 'Team'
  },
  
  followed_teams: [{
    type: Number, // Array of Sportmonks team IDs
    ref: 'Team'
  }],
  
  // Stripe integration fields
  stripe_customer_id: {
    type: String
  },
  stripe_subscription_id: {
    type: String
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
  api_rate_limit_reset: Date,

  // Subscription information
  subscription: {
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
    current_period_start: Date,
    current_period_end: Date,
    cancel_at_period_end: {
      type: Boolean,
      default: false
    },
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
  },

  // Billing history
  billing_history: [{
    amount: Number,
    currency: String,
    description: String,
    status: {
      type: String,
      enum: ['pending', 'completed', 'failed', 'refunded'],
      default: 'pending'
    },
    stripe_invoice_id: String,
    stripe_payment_intent_id: String,
    completed_at: Date,
    failed_at: Date,
    failure_reason: String,
    refunded_at: Date,
    refund_reason: String,
    created_at: {
      type: Date,
      default: Date.now
    }
  }],

  // Privacy settings
  privacy_settings: {
    cookie_consent: {
      necessary: {
        type: Boolean,
        default: true
      },
      analytics: {
        type: Boolean,
        default: false
      },
      marketing: {
        type: Boolean,
        default: false
      },
      personalization: {
        type: Boolean,
        default: false
      },
      updated_at: {
        type: Date,
        default: Date.now
      },
      method: {
        type: String,
        enum: ['accept_all', 'reject_all', 'customize', 'subscription'],
        default: 'customize'
      }
    },
    email_preferences: {
      marketing_emails: {
        type: Boolean,
        default: false
      },
      product_updates: {
        type: Boolean,
        default: true
      },
      security_alerts: {
        type: Boolean,
        default: true
      }
    },
    data_processing: {
      allow_profiling: {
        type: Boolean,
        default: false
      },
      allow_third_party_sharing: {
        type: Boolean,
        default: false
      }
    }
  },

  // Payment methods
  payment_methods: [{
    type: {
      type: String,
      enum: ['card', 'paypal', 'bank_transfer'],
      required: true
    },
    brand: String, // For cards: visa, mastercard, etc.
    last4: String, // Last 4 digits for cards
    exp_month: Number,
    exp_year: Number,
    email: String, // For PayPal
    is_default: {
      type: Boolean,
      default: false
    },
    is_active: {
      type: Boolean,
      default: true
    },
    stripe_payment_method_id: String,
    created_at: {
      type: Date,
      default: Date.now
    },
    updated_at: {
      type: Date,
      default: Date.now
    }
  }]

}, {
  timestamps: true,
  // Include virtuals in JSON output
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
// Note: email index is created automatically by unique: true
userSchema.index({ favourite_team: 1 });
userSchema.index({ followed_teams: 1 });
// Re-enable Stripe indexes (will add subscription indexes later)
// userSchema.index({ 'subscription.status': 1 });
// userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ stripe_customer_id: 1 });
userSchema.index({ stripe_subscription_id: 1 });
userSchema.index({ last_login: -1 });
userSchema.index({ created_at: -1 });
userSchema.index({ is_active: 1, is_verified: 1 });

// Virtual for full name
userSchema.virtual('full_name').get(function() {
  return `${this.first_name} ${this.surname}`;
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



// Static method to find users by team preference
userSchema.statics.findByFavouriteTeam = function(teamId) {
  return this.find({ favourite_team: teamId, is_active: true });
};

// Static method to find users following a team
userSchema.statics.findFollowersOfTeam = function(teamId) {
  return this.find({ followed_teams: teamId, is_active: true });
};

// Instance method to update subscription
userSchema.methods.updateSubscription = function(subscriptionData) {
  // Ensure subscription object exists
  if (!this.subscription) {
    this.subscription = {
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
    };
  }

  // Update subscription fields
  Object.keys(subscriptionData).forEach(key => {
    if (key === 'features' && subscriptionData.features) {
      // Deep merge features
      this.subscription.features = {
        ...this.subscription.features,
        ...subscriptionData.features
      };
    } else {
      this.subscription[key] = subscriptionData[key];
    }
  });

  // Set ad_free based on subscription status and plan
  if (this.subscription.status === 'active' && 
      ['premium', 'pro', 'enterprise'].includes(this.subscription.plan)) {
    this.subscription.features.ad_free = true;
  } else {
    this.subscription.features.ad_free = false;
  }

  return this.save({ validateBeforeSave: false });
};

// Instance method to add billing history entry
userSchema.methods.addBillingEntry = function(billingData) {
  if (!this.billing_history) {
    this.billing_history = [];
  }

  this.billing_history.push({
    ...billingData,
    created_at: new Date()
  });

  return this.save({ validateBeforeSave: false });
};

// Instance method to add payment method
userSchema.methods.addPaymentMethod = function(methodData) {
  if (!this.payment_methods) {
    this.payment_methods = [];
  }

  // If this is set as default, remove default from others
  if (methodData.is_default) {
    this.payment_methods.forEach(method => {
      method.is_default = false;
    });
  }

  this.payment_methods.push({
    ...methodData,
    created_at: new Date(),
    updated_at: new Date()
  });

  return this.save({ validateBeforeSave: false });
};

// Virtual to check if user has active subscription
userSchema.virtual('hasActiveSubscription').get(function() {
  return this.subscription && 
         this.subscription.status === 'active' && 
         ['premium', 'pro', 'enterprise'].includes(this.subscription.plan);
});

// Virtual to check if user should see ads
userSchema.virtual('shouldShowAds').get(function() {
  // Show ads for non-authenticated users and free/inactive subscriptions
  return !this.hasActiveSubscription || !this.subscription?.features?.ad_free;
});

module.exports = mongoose.model('User', userSchema);
