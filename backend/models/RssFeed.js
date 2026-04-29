const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const rssFeedSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => uuidv4().split('-')[0] // Use first 8 chars of UUID for shorter ID
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
  // Feed type: RSS or Atom
  feedType: {
    type: String,
    enum: ['rss', 'atom', 'auto'],
    default: 'auto', // Auto-detect by default
    lowercase: true
  },
  // New field: Tag as generic or team/league/country specific
  scope: {
    type: String,
    enum: ['generic', 'team', 'league', 'country'],
    default: 'generic'
    // index: true // Removed - using compound index below (rssFeedSchema.index)
  },
  // New field: Associated teams (by team ID or slug)
  teams: [{
    type: String, // Can store team ID or slug
    lowercase: true
  }],
  // New field: Associated leagues (by league ID)
  leagues: [{
    type: Number // League IDs
  }],
  // New field: Associated countries (country code or name)
  countries: [{
    type: String,
    lowercase: true
  }],
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
rssFeedSchema.index({ scope: 1 });
rssFeedSchema.index({ teams: 1 });
rssFeedSchema.index({ leagues: 1 });
rssFeedSchema.index({ countries: 1 });

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

// Static method to get feeds by team
rssFeedSchema.statics.findByTeam = function(teamId) {
  return this.find({
    enabled: true,
    $or: [
      { scope: 'generic' },
      { scope: 'team', teams: teamId }
    ]
  }).sort({ priority: 1 });
};

// Static method to get feeds by league
rssFeedSchema.statics.findByLeague = function(leagueId) {
  return this.find({
    enabled: true,
    $or: [
      { scope: 'generic' },
      { scope: 'league', leagues: leagueId }
    ]
  }).sort({ priority: 1 });
};

// Static method to get feeds by country
rssFeedSchema.statics.findByCountry = function(countryCode) {
  return this.find({
    enabled: true,
    $or: [
      { scope: 'generic' },
      { scope: 'country', countries: countryCode.toLowerCase() }
    ]
  }).sort({ priority: 1 });
};

module.exports = mongoose.model('RssFeed', rssFeedSchema);