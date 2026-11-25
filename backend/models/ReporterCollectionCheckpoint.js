const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  _id: String,
  collected_through: { type: Date, required: true },
  expires_at: { type: Date, required: true }
}, { versionKey: false });

schema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('ReporterCollectionCheckpoint', schema);
