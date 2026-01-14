// const mongoose = require('mongoose');

// const teamSchema = new mongoose.Schema({
//   name: {
//     type: String,
//     required: true,
//   },
//   slug: {
//     type: String,
//     unique: true,
//     index: true,
//   },
//   id: {
//     type: Number,
//     required: true,
//     unique: true,
//   },
//   country_id: Number,
//   gender: String,
//   image_path: String,
//   short_code: String,
//   founded: Number,
//   type: String,
//   last_played_at: String,
//   next_game_at: String,
//   last_match_info: {
//     opponent_name: String,
//     goals_for: Number,
//     goals_against: Number,
//     win: Boolean,
//     date: Date,
//     match_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
//     home_game: Boolean,
//   },
//   next_match_info: {
//     opponent_name: String,
//     date: Date,
//     match_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Match' },
//     home_game: Boolean,
//   },

// }, { timestamps: true });

// const slugify = str =>
//   str.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// teamSchema.pre('save', function (next) {
//   if (!this.slug && this.name) {
//     this.slug = slugify(this.name);
//     console.log(`Updating team: ${this.name}`);
//     console.log('Last match info:', this.last_match_info);
//     console.log('Next match info:', this.next_match_info);
//   }
//   next();
// });

// module.exports = mongoose.model('Team', teamSchema);


// models/Team.js



// models/Team.js

const mongoose = require('mongoose');

const SnapshotSchema = new mongoose.Schema(
  {
    opponent_name: String,
    goals_for: Number,
    goals_against: Number,
    win: Boolean,     // undefined for future games
    date: Date,       // kickoff datetime (UTC)
    match_id: Number, // Sportmonks numeric fixture id ✅
    match_oid: {      // Mongo ObjectId of Match doc (optional extra)
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Match'
    },
    home_game: Boolean,
  },
  { _id: false }
);

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, unique: true, index: true },
    id:   { type: Number, unique: true, index: true }, // Sportmonks team id

    country_id: Number,
    gender: { type: String, default: 'male' },
    image_path: String,
    short_code: String,
    founded: Number,
    type: { type: String, default: 'domestic' },

    last_played_at: Date,
    next_game_at: Date,

    // New reference-based approach - references by match_id field
    last_match: { type: Number, index: true },
    next_match: { type: Number, index: true },

    // Legacy embedded data (will be removed after migration)
    last_match_info: SnapshotSchema,
    next_match_info: SnapshotSchema,

    // Cache metadata for tracking freshness of match info
    cache_metadata: {
      cached_at: { type: Date, default: null },           // When was cache last updated
      cache_version: { type: Number, default: 1 },        // For cache invalidation strategies
      last_computed_by: { type: String, default: null },  // 'cron', 'manual', 'api', etc.
      computation_duration_ms: { type: Number, default: null }, // How long computation took
    },

    // Twitter/Social Media integration
    twitter: {
      reporters: [{
        name: String,
        handle: String, // Twitter handle (e.g., @username)
        verified: { type: Boolean, default: false },
        follower_count: Number,
        last_checked: Date
      }],
      hashtag: String, // Primary hashtag for the team (e.g., #MUFC)
      alternative_hashtags: [String], // Additional hashtags
      last_tweet_fetch: Date, // When we last fetched tweets for this team
      tweet_fetch_enabled: { type: Boolean, default: true }
    }
  },
  { timestamps: true }
);

// slugify
const slugify = (str) =>
  String(str || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

teamSchema.pre('save', function (next) {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name);
  }
  next();
});

// Virtual field to compute if cache is stale
teamSchema.virtual('cache_is_stale').get(function() {
  if (!this.cache_metadata?.cached_at) return true; // No cache timestamp = stale
  
  const CACHE_TTL_MS = Number(process.env.TEAM_CACHE_TTL_MS || 6 * 60 * 60 * 1000); // 6 hours default
  const now = new Date();
  const cacheAge = now.getTime() - this.cache_metadata.cached_at.getTime();
  
  return cacheAge > CACHE_TTL_MS;
});

// Virtual field to get cache age in minutes
teamSchema.virtual('cache_age_minutes').get(function() {
  if (!this.cache_metadata?.cached_at) return null;
  
  const now = new Date();
  const ageMs = now.getTime() - this.cache_metadata.cached_at.getTime();
  return Math.round(ageMs / (60 * 1000));
});

// Include virtuals when converting to JSON
teamSchema.set('toJSON', { virtuals: true });
teamSchema.set('toObject', { virtuals: true });

// keep only these helpers (avoid duplicate index warnings)
teamSchema.index({ last_played_at: -1 });
teamSchema.index({ next_game_at: 1 });
teamSchema.index({ 'cache_metadata.cached_at': -1 }); // For finding stale teams

module.exports = mongoose.model('Team', teamSchema);