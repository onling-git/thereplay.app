const mongoose = require('mongoose');

// Schema for a fixture in a cup round
const cupFixtureSchema = new mongoose.Schema({
  fixture_id: { type: Number, required: true },
  home_team_id: Number,
  away_team_id: Number,
  home_team_name: String,
  away_team_name: String,
  home_score: Number,
  away_score: Number,
  winner_team_id: Number,  // ID of the team that progressed
  status: String,  // NS (Not Started), LIVE, FT (Full Time), etc.
  date: Date,
  has_extra_time: Boolean,
  has_penalties: Boolean
}, { _id: false });

// Schema for a cup stage/round
const cupStageSchema = new mongoose.Schema({
  stage_id: { type: Number, required: true },
  stage_name: String,  // "Semi-finals", "Final", "Round 3", etc.
  stage_type_id: Number,  // 224 for regular, 225 for qualifying/replays
  sort_order: Number,  // To order stages chronologically
  fixtures: [cupFixtureSchema],
  teams_remaining: [{ 
    team_id: Number,
    team_name: String,
    team_image: String
  }]
}, { _id: false });

// Main Cup Competition schema
const cupCompetitionSchema = new mongoose.Schema({
  // Competition metadata
  league_id: { type: Number, required: true, index: true },
  league_name: String,
  league_slug: String,
  league_image: String,
  sub_type: { type: String, default: 'domestic_cup' },
  
  // Season info
  season_id: { type: Number, required: true, index: true },
  season_name: String,
  
  // Cup stages and progression
  stages: [cupStageSchema],
  
  // Current stage tracking
  current_stage_id: Number,
  current_stage_name: String,
  
  // Winner info (when tournament concludes)
  winner_team_id: Number,
  winner_team_name: String,
  
  // Timestamps
  last_synced: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes
cupCompetitionSchema.index({ league_id: 1, season_id: 1 }, { unique: true });
cupCompetitionSchema.index({ 'stages.stage_id': 1 });
cupCompetitionSchema.index({ 'stages.fixtures.fixture_id': 1 });

// Static method to get current cup for a league
cupCompetitionSchema.statics.getCurrentForLeague = async function(leagueId) {
  return await this.findOne({ league_id: leagueId })
    .sort({ season_id: -1 })
    .exec();
};

// Static method to get cup by season
cupCompetitionSchema.statics.getBySeasonId = async function(seasonId) {
  return await this.findOne({ season_id: seasonId }).exec();
};

// Method to get a specific stage
cupCompetitionSchema.methods.getStage = function(stageId) {
  return this.stages.find(stage => stage.stage_id === stageId);
};

// Method to get teams still in the competition
cupCompetitionSchema.methods.getRemainingTeams = function() {
  // Get the latest completed stage
  const completedStages = this.stages
    .filter(stage => stage.fixtures.some(f => f.status === 'FT'))
    .sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
  
  if (completedStages.length === 0) return [];
  
  return completedStages[0].teams_remaining || [];
};

const CupCompetition = mongoose.model('CupCompetition', cupCompetitionSchema);

module.exports = CupCompetition;
