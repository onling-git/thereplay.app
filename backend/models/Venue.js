const mongoose = require('mongoose');

const VenueDetailsSchema = new mongoose.Schema({
  id: Number,
  slug: String,
  name: String,
  address: String,
  city_name: String,
  country_code: String,
  country_id: Number,
  postal_code: String,
  capacity: Number,
  image_path: String,
}, { _id: false });

const VenueSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  name: String,
  address: String,
  city_name: String,
  country_code: String,
  country_id: Number,
  postal_code: String,
  capacity: Number,
  image_path: String,
}, { timestamps: true });

module.exports = mongoose.model('Venue', VenueSchema);
module.exports.VenueDetailsSchema = VenueDetailsSchema;
