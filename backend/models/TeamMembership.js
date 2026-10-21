// models/TeamMembership.js
// Provider-sourced season participation of a team in a domestic league.
// Public coverage policy queries active rows whose season_id matches League.current_season_id.
const mongoose = require('mongoose');

const teamMembershipSchema = new mongoose.Schema({
  team_id: { type: Number, required: true },
  league_id: { type: Number, required: true },
  season_id: { type: Number, required: true },
  active: { type: Boolean, default: true },
  source: { type: String, default: 'sportmonks' },
  first_seen_at: { type: Date, default: null },
  synced_at: { type: Date, default: null }
}, { timestamps: true });

teamMembershipSchema.index({ team_id: 1, league_id: 1, season_id: 1 }, { unique: true });
teamMembershipSchema.index({ league_id: 1, season_id: 1, active: 1 });
teamMembershipSchema.index({ team_id: 1, active: 1 });

module.exports = mongoose.models.TeamMembership
  || mongoose.model('TeamMembership', teamMembershipSchema);
