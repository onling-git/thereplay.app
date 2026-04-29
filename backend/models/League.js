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
  }
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