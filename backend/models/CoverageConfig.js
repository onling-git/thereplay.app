// models/CoverageConfig.js
// Single document (_id: 'public-coverage') describing public coverage initialisation state.
const mongoose = require('mongoose');

const COVERAGE_CONFIG_ID = 'public-coverage';

const coverageConfigSchema = new mongoose.Schema({
  _id: { type: String, default: COVERAGE_CONFIG_ID },
  // True once a complete membership sync has succeeded; public policy relies on this.
  initialized: { type: Boolean, default: false },
  initialized_at: { type: Date, default: null },
  // Bumped after every complete catalogue refresh, membership sync or launch bootstrap.
  revision: { type: Number, default: 0 },
  launch_initialized: { type: Boolean, default: false },
  launch_initialized_at: { type: Date, default: null },
  last_catalog_refresh_at: { type: Date, default: null },
  last_catalog_stats: { type: mongoose.Schema.Types.Mixed, default: null },
  last_membership_sync_at: { type: Date, default: null },
  last_membership_stats: { type: mongoose.Schema.Types.Mixed, default: null }
}, { timestamps: true, versionKey: false, minimize: false });

const CoverageConfig = mongoose.models.CoverageConfig
  || mongoose.model('CoverageConfig', coverageConfigSchema);

module.exports = CoverageConfig;
module.exports.COVERAGE_CONFIG_ID = COVERAGE_CONFIG_ID;
