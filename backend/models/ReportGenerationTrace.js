const mongoose = require('mongoose');

const RunTraceSchema = new mongoose.Schema({
  prompt_version: { type: String },
  prompt_hash: { type: String },
  model: { type: String },
  system_prompt: { type: String },
  started_at: { type: Date },
  completed_at: { type: Date },
  input_snapshot: { type: mongoose.Schema.Types.Mixed },
  prompt: { type: String },
  repair_prompt: { type: String },
  output: { type: mongoose.Schema.Types.Mixed },
  error: { type: String }
}, { _id: false });

const ReportGenerationTraceSchema = new mongoose.Schema({
  generation_id: { type: String, required: true, unique: true, index: true },
  match_id: { type: Number, required: true, index: true },
  team_slug: { type: String, required: true, index: true },
  report_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Report', default: null },
  status: { type: String, enum: ['started', 'completed', 'failed'], default: 'started' },
  started_at: { type: Date, required: true },
  completed_at: { type: Date },
  run1: { type: RunTraceSchema, default: () => ({}) },
  run2: { type: RunTraceSchema, default: () => ({}) },
  validation: {
    warnings: { type: [String], default: [] },
    errors: { type: [String], default: [] }
  },
  error: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ReportGenerationTrace', ReportGenerationTraceSchema);
