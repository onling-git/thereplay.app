// models/Country.js
const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  id: { 
    type: Number, 
    required: true, 
    unique: true, 
    index: true 
  }, // SportMonks country id
  name: { 
    type: String, 
    required: true 
  },
  iso2: { 
    type: String 
  }, // ISO 2-letter country code
  iso3: { 
    type: String 
  }, // ISO 3-letter country code
  continent_id: { 
    type: Number 
  },
  continent_name: { 
    type: String 
  },
  flag_path: { 
    type: String 
  }, // URL to flag image
  // Additional SportMonks fields
  official_name: { 
    type: String 
  },
  fifa_name: { 
    type: String 
  }
}, { 
  timestamps: true 
});

// Create compound indexes for better query performance
countrySchema.index({ name: 1 });
countrySchema.index({ iso2: 1 });
countrySchema.index({ continent_id: 1 });

module.exports = mongoose.model('Country', countrySchema);