const mongoose = require('mongoose');

const rssFeedSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  url: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: 'URL must be a valid HTTP or HTTPS URL'
    }
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  priority: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  keywords: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  description: {
    type: String,
    trim: true,
    default: ''
  },
  lastFetched: {
    type: Date,
    default: null
  },
  lastSuccess: {
    type: Date,
    default: null
  },
  lastError: {
    type: String,
    default: null
  },
  articleCount: {
    type: Number,
    default: 0
  },
  fetchTimeout: {
    type: Number,
    default: 10000, // 10 seconds
    min: 1000,
    max: 30000
  },
  userAgent: {
    type: String,
    default: 'Mozilla/5.0 (compatible; FootballNewsAggregator/1.0)'
  }
}, {
  timestamps: true,
  collection: 'rss_feeds'
});

// Index for efficient queries
rssFeedSchema.index({ enabled: 1, priority: 1 });
rssFeedSchema.index({ keywords: 1 });

// Virtual for status
rssFeedSchema.virtual('status').get(function() {
  if (!this.enabled) return 'disabled';
  if (!this.lastFetched) return 'never-fetched';
  if (this.lastError) return 'error';
  return 'active';
});

// Instance method to update fetch stats
rssFeedSchema.methods.updateFetchStats = function(success, articleCount = 0, error = null) {
  this.lastFetched = new Date();
  if (success) {
    this.lastSuccess = new Date();
    this.articleCount = articleCount;
    this.lastError = null;
  } else {
    this.lastError = error;
  }
  return this.save();
};

// Static method to get enabled feeds sorted by priority
rssFeedSchema.statics.getEnabledFeeds = function() {
  return this.find({ enabled: true }).sort({ priority: 1, name: 1 });
};

// Static method to get feeds by keywords
rssFeedSchema.statics.findByKeywords = function(keywords) {
  const keywordArray = Array.isArray(keywords) ? keywords : [keywords];
  return this.find({
    enabled: true,
    keywords: { $in: keywordArray.map(k => k.toLowerCase()) }
  }).sort({ priority: 1 });
};

module.exports = mongoose.model('RssFeed', rssFeedSchema);