// models/League.js
const mongoose = require('mongoose');

const leagueSchema = new mongoose.Schema({
  id: { 
    type: Number, 
    required: true, 
    unique: true, 
    index: true 
  }, // SportMonks league id
  name: { 
    type: String, 
    required: true 
  },
  short_code: { 
    type: String 
  },
  image_path: { 
    type: String 
  }, // URL to league logo
  country_id: { 
    type: Number, 
    ref: 'Country',
    required: true,
    index: true 
  }, // Reference to Country model
  type: { 
    type: String 
  }, // league, cup, etc.
  sub_type: { 
    type: String 
  },
  last_played_at: { 
    type: Date 
  },
  category: { 
    type: Number 
  }, // SportMonks category
  has_jerseys: { 
    type: Boolean, 
    default: false 
  },
  coverage: {
    predictions: { type: Boolean, default: false },
    topscorer_goals: { type: Boolean, default: false },
    topscorer_assists: { type: Boolean, default: false },
    topscorer_cards: { type: Boolean, default: false }
  },
  is_cup: { 
    type: Boolean, 
    default: false 
  },
  // League management fields
  coverage_role: { type: String, enum: ['league', 'competition'], default: 'competition' },
  reports_enabled: { type: Boolean, default: false },
  reports_start_at: Date,
  available: { type: Boolean, default: false },
  availability_status: { type: String, default: 'unknown' },
  last_seen_at: Date,
  last_checked_at: Date,
  current_season_id: Number,
  membership_synced_at: Date,
  membership_season_id: Number,
  enabled: { 
    type: Boolean, 
    default: false,
    index: true
  }, // Whether this league is actively monitored
  priority: { 
    type: Number, 
    default: 0
  } // Sync priority (higher = synced first)
}, { 
  timestamps: true 
});

// Virtual to populate country details
leagueSchema.virtual('country', {
  ref: 'Country',
  localField: 'country_id',
  foreignField: 'id',
  justOne: true
});

// Ensure virtual fields are serialized
leagueSchema.set('toJSON', { virtuals: true });
leagueSchema.set('toObject', { virtuals: true });

// Indexes for better query performance
leagueSchema.index({ name: 1 });
leagueSchema.index({ country_id: 1, name: 1 });
leagueSchema.index({ type: 1 });

module.exports = mongoose.model('League', leagueSchema);