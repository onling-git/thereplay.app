const mongoose = require('mongoose');

const teamRssFeedSubscriptionSchema = new mongoose.Schema({
  teamId: {
    type: Number, // Team ID from SportMonks
    required: true,
    unique: true,
    index: true
  },
  teamSlug: {
    type: String,
    lowercase: true,
    index: true
  },
  teamName: {
    type: String,
    trim: true
  },
  feeds: [{
    feedId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RssFeed',
      required: true
    },
    priority: {
      type: Number,
      default: 1,
      min: 1,
      max: 100
    }
  }],
  description: {
    type: String,
    trim: true,
    default: ''
  },
  enabled: {
    type: Boolean,
    default: true,
    index: true
  },
  lastArticleFetch: {
    type: Date,
    default: null
  },
  articleCount: {
    type: Number,
    default: 0
  },
  cacheKey: {
    type: String,
    // Will be set to `team_articles_{teamId}`
  }
}, {
  timestamps: true,
  collection: 'team_rss_subscriptions'
});

// Index for efficient queries
teamRssFeedSubscriptionSchema.index({ teamId: 1, enabled: 1 });
teamRssFeedSubscriptionSchema.index({ teamSlug: 1 });

// Virtual for cache TTL recommendation
teamRssFeedSubscriptionSchema.virtual('suggestedCacheTTL').get(function() {
  // Popular teams (more views) = shorter cache
  // Based on articleCount as a proxy for popularity
  if (this.articleCount > 50) return 3600; // 1 hour
  if (this.articleCount > 20) return 7200; // 2 hours
  return 14400; // 4 hours for smaller teams
});

// Instance method to get cache key
teamRssFeedSubscriptionSchema.methods.getCacheKey = function() {
  return `team_articles_${this.teamId}`;
};

// Static method to get subscription with populated feeds
teamRssFeedSubscriptionSchema.statics.getWithFeeds = function(teamId) {
  return this.findOne({ teamId, enabled: true })
    .populate({
      path: 'feeds.feedId',
      match: { enabled: true },
      select: 'id name url priority keywords -_id'
    });
};

// Static method to create or update subscription
teamRssFeedSubscriptionSchema.statics.upsertSubscription = async function(teamId, teamSlug, teamName, feeds = []) {
  return this.findOneAndUpdate(
    { teamId },
    {
      teamId,
      teamSlug: teamSlug.toLowerCase(),
      teamName,
      feeds: feeds.map(feedId => ({ feedId })),
      cacheKey: `team_articles_${teamId}`
    },
    { upsert: true, new: true, runValidators: true }
  );
};

// Static method to get feeds for a team
teamRssFeedSubscriptionSchema.statics.getTeamFeeds = async function(teamId) {
  const subscription = await this.findOne({ teamId, enabled: true })
    .populate('feeds.feedId');
  
  if (!subscription || !subscription.feeds.length) {
    return [];
  }

  return subscription.feeds
    .filter(f => f.feedId) // Filter out any null references
    .sort((a, b) => a.priority - b.priority)
    .map(f => f.feedId);
};

module.exports = mongoose.model('TeamRssFeedSubscription', teamRssFeedSubscriptionSchema);
