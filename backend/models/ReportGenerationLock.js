const mongoose = require('mongoose');

const ReportGenerationLockSchema = new mongoose.Schema({
  _id: { type: String },
  owner: { type: String, required: true },
  expires_at: { type: Date, required: true }
}, { versionKey: false });

module.exports = mongoose.model('ReportGenerationLock', ReportGenerationLockSchema);
