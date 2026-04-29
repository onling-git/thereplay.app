const mongoose = require('mongoose');

const standingEntrySchema = new mongoose.Schema({
  position: { type: Number, required: true },
  participant_id: { type: Number, required: true }, // Sportmonks team ID
  team_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Team' }, // Our team ref (if we have it)
  points: { type: Number, required: true },
  trend: { type: String, enum: ['up', 'down', 'equal'] }, // result from API
  
  // Stats (extracted from details array)
  played: { type: Number, default: 0 },
  won: { type: Number, default: 0 },
  drawn: { type: Number, default: 0 },
  lost: { type: Number, default: 0 },
  goals_for: { type: Number, default: 0 },
  goals_against: { type: Number, default: 0 },
  goal_difference: { type: Number, default: 0 },
  
  // Optional: Recent form (last 5 matches)
  form: [{ type: String, enum: ['W', 'D', 'L'] }], // e.g., ['W', 'W', 'D', 'L', 'W']
  
  // Standing rule (for promoted/relegated zones)
  standing_rule_id: { type: Number }
}, { _id: false });

const standingSchema = new mongoose.Schema({
  // League/Competition info
  league_id: { type: Number, required: true, index: true }, // Sportmonks league ID
  league_name: { type: String },
  season_id: { type: Number, required: true, index: true },
  season_name: { type: String }, // e.g., "2025/2026"
  
  // Stage info (for cups with multiple stages)
  stage_id: { type: Number, index: true },
  stage_name: { type: String }, // e.g., "Regular Season", "Quarter Finals"
  
  // Round info
  round_id: { type: Number },
  round_name: { type: String },
  
  // Competition type
  is_cup: { type: Boolean, default: false },
  
  // The actual standings table
  table: [standingEntrySchema],
  
  // Metadata
  last_updated: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Compound index for efficient queries
standingSchema.index({ league_id: 1, season_id: 1 });
standingSchema.index({ season_id: 1, stage_id: 1 });

// Index for finding a team's standings across competitions
standingSchema.index({ 'table.participant_id': 1 });

// Method to get a specific team's standing
standingSchema.methods.getTeamStanding = function(participantId) {
  return this.table.find(entry => entry.participant_id === participantId);
};

// Static method to get current standings for a league
standingSchema.statics.getCurrentForLeague = async function(leagueId) {
  const Team = require('./Team');
  
  const standing = await this.findOne({ league_id: leagueId })
    .sort({ 'season_id': -1, updated_at: -1 })
    .limit(1)
    .lean();
  
  if (!standing) return null;
  
  // Get all participant IDs
  const participantIds = standing.table.map(entry => entry.participant_id);
  
  // Fetch all teams in one query
  const teams = await Team.find({ 
    id: { $in: participantIds } 
  }).select('id name slug image_path').lean();
  
  // Create lookup map
  const teamMap = {};
  teams.forEach(team => {
    teamMap[team.id] = team;
  });
  
  // Enrich entries with team details
  standing.table.forEach(entry => {
    const team = teamMap[entry.participant_id];
    if (team) {
      entry.team_name = team.name;
      entry.team_slug = team.slug;
      entry.team_image = team.image_path;
    }
  });
  
  return standing;
};

// Static method to get all standings for a team across all competitions
// Now with team name population
standingSchema.statics.getTeamStandings = async function(participantId) {
  const Team = require('./Team');
  
  // Get standings
  const standings = await this.find({ 'table.participant_id': participantId })
    .sort({ updated_at: -1 })
    .lean();
  
  // Get all unique participant IDs from all standings tables
  const participantIds = new Set();
  standings.forEach(standing => {
    standing.table.forEach(entry => {
      participantIds.add(entry.participant_id);
    });
  });
  
  // Fetch all teams in one query
  const teams = await Team.find({ 
    id: { $in: Array.from(participantIds) } 
  }).select('id name slug image_path').lean();
  
  // Create lookup map
  const teamMap = {};
  teams.forEach(team => {
    teamMap[team.id] = team;
  });
  
  // Enrich each standing entry with team details
  standings.forEach(standing => {
    standing.table.forEach(entry => {
      const team = teamMap[entry.participant_id];
      if (team) {
        entry.team_name = team.name;
        entry.team_slug = team.slug;
        entry.team_image = team.image_path;
      }
    });
  });
  
  return standings;
};

module.exports = mongoose.model('Standing', standingSchema);
