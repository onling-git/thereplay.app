const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  path: { type: String, required: true, unique: true },
  newest_published_at: { type: Date, default: null }
});

module.exports = mongoose.model('NewsCollectionSnapshot', schema);
