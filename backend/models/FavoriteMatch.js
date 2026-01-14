// models/FavoriteMatch.js
const mongoose = require('mongoose');

const FavoriteMatchSchema = new mongoose.Schema({
  // User who favorited the match
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Match details (using SportMonks ID for consistency)
  match_id: {
    type: Number, // SportMonks match ID
    required: true,
    index: true
  },
  
  // Match information for easy display (denormalized for performance)
  match_info: {
    starting_at: {
      type: Date,
      required: true,
      index: true // For date-based queries and cleanup
    },
    home_team: {
      team_id: Number,
      team_name: String,
      team_slug: String
    },
    away_team: {
      team_id: Number,
      team_name: String,
      team_slug: String
    },
    league: {
      id: Number,
      name: String,
      short_code: String
    },
    venue: {
      name: String,
      city_name: String
    }
  },
  
  // How the match was added to favorites
  source: {
    type: String,
    enum: ['manual', 'auto_favorite_team', 'auto_followed_team'],
    default: 'manual',
    index: true
  },
  
  // Auto-cleanup after 14 days from match date
  expires_at: {
    type: Date,
    default: function() {
      if (this.match_info && this.match_info.starting_at) {
        const matchDate = new Date(this.match_info.starting_at);
        return new Date(matchDate.getTime() + (14 * 24 * 60 * 60 * 1000)); // 14 days after match
      }
      return new Date(Date.now() + (14 * 24 * 60 * 60 * 1000)); // 14 days from now as fallback
    },
    index: true
  },
  
  // Notifications preferences (for future use)
  notifications: {
    match_start: {
      type: Boolean,
      default: true
    },
    goals: {
      type: Boolean,
      default: true
    },
    final_result: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true,
  // Compound indexes for efficient queries
  indexes: [
    { user_id: 1, match_id: 1 }, // Unique constraint
    { user_id: 1, 'match_info.starting_at': -1 }, // User's matches by date
    { expires_at: 1 } // For cleanup job
  ]
});

// Compound unique index to prevent duplicate favorites
FavoriteMatchSchema.index({ user_id: 1, match_id: 1 }, { unique: true });

// Static method to find user's favorite matches
FavoriteMatchSchema.statics.findByUser = function(userId, options = {}) {
  const query = this.find({ user_id: userId });
  
  if (options.upcoming) {
    query.where('match_info.starting_at').gt(new Date());
  }
  
  if (options.past) {
    query.where('match_info.starting_at').lt(new Date());
  }
  
  return query.sort({ 'match_info.starting_at': options.sortDesc ? -1 : 1 });
};

// Static method to find matches that need cleanup
FavoriteMatchSchema.statics.findExpired = function() {
  return this.find({ expires_at: { $lt: new Date() } });
};

// Static method to check if match is favorited by user
FavoriteMatchSchema.statics.isFavorited = async function(userId, matchId) {
  const favorite = await this.findOne({ user_id: userId, match_id: matchId });
  return !!favorite;
};

// Instance method to extend expiry date (for active matches)
FavoriteMatchSchema.methods.extendExpiry = function(days = 14) {
  const matchDate = new Date(this.match_info.starting_at);
  this.expires_at = new Date(matchDate.getTime() + (days * 24 * 60 * 60 * 1000));
  return this.save();
};

module.exports = mongoose.model('FavoriteMatch', FavoriteMatchSchema);