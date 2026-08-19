// models/TeamStoryPromptSettings.js
// Singleton document holding admin-editable overrides for the Team Story research
// and writing system prompts. Empty string = fall back to the built-in default
// prompt defined in the corresponding service file.
const mongoose = require('mongoose');

const teamStoryPromptSettingsSchema = new mongoose.Schema({
  singleton: { type: String, default: 'default', unique: true },
  research_system_prompt: { type: String, default: '' },
  writing_system_prompt: { type: String, default: '' },
  updated_at: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('TeamStoryPromptSettings', teamStoryPromptSettingsSchema);
