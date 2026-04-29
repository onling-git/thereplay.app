// models/Tweet.js
const mongoose = require('mongoose');

const AuthorSchema = new mongoose.Schema({
  id: { type: String, required: true },
  userName: String,
  name: String,
  profilePicture: String,
  description: String,
  followers: Number,
  following: Number,
  isBlueVerified: Boolean,
  verifiedType: String
}, { _id: false });

const MediaSchema = new mongoose.Schema({
  type: { type: String, enum: ['photo', 'video', 'animated_gif'] },
  url: String,
  media_url_https: String,
  display_url: String,
  expanded_url: String,
  sizes: {
    thumb: { w: Number, h: Number },
    small: { w: Number, h: Number },
    medium: { w: Number, h: Number },
    large: { w: Number, h: Number }
  }
}, { _id: false });

const EntitySchema = new mongoose.Schema({
  hashtags: [{
    text: String,
    indices: [Number]
  }],
  urls: [{
    display_url: String,
    expanded_url: String,
    url: String,
    indices: [Number]
  }],
  user_mentions: [{
    id_str: String,
    name: String,
    screen_name: String,
    indices: [Number]
  }],
  media: [MediaSchema]
}, { _id: false });

const TweetSchema = new mongoose.Schema({
  // Core tweet data
  tweet_id: { type: String, required: true, unique: true, index: true },
  text: { type: String, required: true },
  url: String,
  
  // Author information
  author: AuthorSchema,
  
  // Timing
  created_at: { type: Date, required: true, index: true },
  fetched_at: { type: Date, default: Date.now },
  
  // Engagement metrics
  retweetCount: { type: Number, default: 0 },
  replyCount: { type: Number, default: 0 },
  likeCount: { type: Number, default: 0 },
  quoteCount: { type: Number, default: 0 },
  viewCount: { type: Number, default: 0 },
  bookmarkCount: { type: Number, default: 0 },
  
  // Tweet metadata
  lang: String,
  source: String,
  isReply: { type: Boolean, default: false },
  inReplyToId: String,
  inReplyToUserId: String,
  inReplyToUsername: String,
  conversationId: String,
  
  // Structured entities (hashtags, mentions, urls, media)
  entities: EntitySchema,
  
  // Media attachments (photos, videos, gifs)
  media: [MediaSchema],
  
  // Retweet/Quote information
  isRetweet: { type: Boolean, default: false },
  retweetedTweet: {
    tweet_id: String,
    text: String,
    author: AuthorSchema,
    created_at: Date,
    media: [MediaSchema],
    retweetCount: Number,
    replyCount: Number,
    likeCount: Number
  },
  
  isQuote: { type: Boolean, default: false },
  quotedTweet: {
    tweet_id: String,
    text: String,
    author: AuthorSchema,
    created_at: Date,
    media: [MediaSchema],
    url: String
  },
  
  // Team association
  team_id: { type: Number, index: true }, // Sportmonks team ID
  team_slug: { type: String }, // Team slug for easy lookup (indexed via compound index below)
  team_name: String, // Team name for display
  
  // Match association (optional)
  match_id: { type: Number, index: true }, // If tweet is related to specific match
  match_date: Date, // Date of the match this tweet relates to
  
  // Collection metadata
  collection_context: {
    search_query: String, // The query used to find this tweet
    search_type: { type: String, enum: ['hashtag', 'user', 'keyword', 'mixed', 'team_search', 'match_search', 'reporter'], default: 'mixed' },
    relevance_score: { type: Number, min: 0, max: 1 }, // Calculated relevance to team/match
    collected_for: { type: String, enum: ['pre_match', 'live_match', 'post_match', 'general', 'team_feed'], default: 'general' },
    tags: [String], // Additional tags for categorization
    source_priority: { type: Number, min: 1, max: 10 } // Priority for tweet source (1 = highest priority)
  },
  
  // Content analysis (for AI processing)
  analysis: {
    sentiment: { type: String, enum: ['positive', 'negative', 'neutral'] },
    topics: [String], // Extracted topics/themes
    mentions_players: [String], // Player names mentioned
    mentions_teams: [String], // Team names mentioned
    is_match_related: { type: Boolean, default: false },
    is_news_worthy: { type: Boolean, default: false }
  },
  
  // Status and processing
  status: { type: String, enum: ['raw', 'processed', 'verified', 'flagged'], default: 'raw' },
  processed_at: Date,
  
  // TwitterAPI.io specific fields
  api_source: { type: String, default: 'twitterapi.io' },
  api_response_meta: mongoose.Schema.Types.Mixed // Store any additional API response data
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries
TweetSchema.index({ team_id: 1, created_at: -1 });
TweetSchema.index({ team_slug: 1, created_at: -1 });
TweetSchema.index({ match_id: 1, created_at: -1 });
TweetSchema.index({ 'collection_context.collected_for': 1, created_at: -1 });
TweetSchema.index({ 'analysis.is_match_related': 1, created_at: -1 });
TweetSchema.index({ 'analysis.sentiment': 1, team_id: 1 });

// Virtual for engagement total
TweetSchema.virtual('total_engagement').get(function() {
  return (this.retweetCount || 0) + 
         (this.replyCount || 0) + 
         (this.likeCount || 0) + 
         (this.quoteCount || 0);
});

// Virtual for age in hours
TweetSchema.virtual('age_hours').get(function() {
  if (!this.created_at) return null;
  return Math.round((Date.now() - this.created_at.getTime()) / (1000 * 60 * 60));
});

// Static method to find tweets by team and date range
TweetSchema.statics.findByTeamAndDateRange = function(teamId, startDate, endDate, options = {}) {
  const query = {
    team_id: teamId,
    created_at: {
      $gte: startDate,
      $lte: endDate
    }
  };
  
  if (options.matchRelated) {
    query['analysis.is_match_related'] = true;
  }
  
  if (options.sentiment) {
    query['analysis.sentiment'] = options.sentiment;
  }
  
  return this.find(query)
    .sort({ created_at: -1 })
    .limit(options.limit || 50);
};

// Static method to find recent tweets for report generation
TweetSchema.statics.findForReport = function(teamId, matchDate, options = {}) {
  const matchStart = new Date(matchDate);
  const preMatch = new Date(matchStart.getTime() - (options.preMatchHours || 24) * 60 * 60 * 1000);
  const postMatch = new Date(matchStart.getTime() + (options.postMatchHours || 6) * 60 * 60 * 1000);
  
  return this.find({
    team_id: teamId,
    created_at: { $gte: preMatch, $lte: postMatch },
    status: { $in: ['raw', 'processed', 'verified'] }
  })
  .sort({ 
    'collection_context.source_priority': 1, // Reporter tweets first (priority 1), then hashtag (priority 2)
    'analysis.is_match_related': -1, // Match-related tweets within same source priority
    total_engagement: -1, // Then by engagement within same source and match-relation
    created_at: -1 // Finally by recency
  })
  .limit(options.limit || 20);
};

module.exports = mongoose.model('Tweet', TweetSchema);
