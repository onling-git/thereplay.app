// models/ReportStaging.js
// Draft report generations kept separate from the live Report collection so admins
// can iterate on report-generation changes without affecting what users see.
const mongoose = require('mongoose');

const ReportStagingSchema = new mongoose.Schema({
  match_id: { type: Number, required: true, index: true },
  team_slug: { type: String, required: true, lowercase: true, trim: true, index: true },
  team_name: { type: String },
  // Raw pipeline output + metadata, kept verbatim so it can be handed straight to
  // saveReportToDatabase() if/when the draft is promoted to the live report.
  report: { type: mongoose.Schema.Types.Mixed, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed },
  interpretation: { type: mongoose.Schema.Types.Mixed },
  generated_by: { type: String },
  generated_at: { type: Date, default: Date.now }
}, { strict: false, timestamps: true });

ReportStagingSchema.index({ match_id: 1, team_slug: 1 }, { unique: true });

module.exports = mongoose.model('ReportStaging', ReportStagingSchema);
