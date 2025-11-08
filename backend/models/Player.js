// models/Player.js
const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema({
  name: { type: String, required: true, index: true },
  sportmonks_id: { type: Number, index: true, sparse: true },
  position: String,
  team_id: Number,
  profile_image: String,
  season_stats: {
    matches: Number,
    goals: Number,
    assists: Number,
    xg: Number
  }
}, { timestamps: true });

module.exports = mongoose.model('Player', PlayerSchema);
