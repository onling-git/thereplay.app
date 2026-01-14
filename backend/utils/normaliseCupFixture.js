// utils/normaliseCupFixture.js
// Dedicated function for normalizing cup competition fixtures
// This avoids breaking the existing league fixture normalization

const mongoose = require('mongoose');

function parseProviderDate(val) {
  if (val == null) return null;
  if (typeof val === 'number') {
    return new Date(val > 1e10 ? val : val * 1000);
  }
  const s = String(val).trim();
  if (!s) return null;
  // Common no-zone format: 'YYYY-MM-DD HH:mm:ss' -> interpret as UTC
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) {
    return new Date(s.replace(' ', 'T') + 'Z');
  }
  if (/^\d{10}$/.test(s)) return new Date(Number(s) * 1000);
  if (/^\d{13}$/.test(s)) return new Date(Number(s));
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d;
  return null;
}

// Map cup competition league IDs to competition names
const CUP_COMPETITIONS = {
  24: 'FA Cup',
  27: 'EFL Cup',
  // Add more as needed
};

// Map cup stage names to standardized display names
const STAGE_NAME_MAP = {
  'Round 3': 'Third Round',
  'Round 4': 'Fourth Round',
  'Round 5': 'Fifth Round',
  'Round 6': 'Quarter Final',
  'Round 7': 'Semi Final',
  'Round 8': 'Final',
  // Add more mappings as needed
};

/**
 * Normalizes a SportMonks v3 cup fixture into Match schema format
 * Specifically designed for cup competitions with stage/round data
 * @param {Object} cupFixture - Raw SportMonks cup fixture data
 * @returns {Object} - Normalized match document for cup fixtures
 */
function normaliseCupFixture(cupFixture) {
  if (!cupFixture || !cupFixture.id) {
    console.warn('[normaliseCupFixture] Invalid or missing fixture data');
    return null;
  }

  // Extract basic fixture info
  const match_id = Number(cupFixture.id);
  const date = parseProviderDate(cupFixture.starting_at) || new Date();
  
  // Extract time (HH:MM format)
  const time = cupFixture.starting_at ? 
    cupFixture.starting_at.split(' ')[1]?.substring(0, 5) || '15:00' : 
    '15:00';

  // Get competition info
  const league_id = cupFixture.league_id;
  const competition_name = CUP_COMPETITIONS[league_id] || `Cup Competition (${league_id})`;
  const competition_logo = `https://cdn.sportmonks.com/images/soccer/leagues/${league_id}.png`;

  // Extract participants (teams)
  const participants = cupFixture.participants || [];
  let homeTeam = null;
  let awayTeam = null;

  if (participants.length >= 2) {
    homeTeam = participants.find(p => p.meta?.location === 'home') || participants[0];
    awayTeam = participants.find(p => p.meta?.location === 'away') || participants[1];
  }

  if (!homeTeam || !awayTeam) {
    console.warn(`[normaliseCupFixture] Missing team data for fixture ${match_id}`);
    return null;
  }

  // Extract stage and round information for cups
  const stage_id = cupFixture.stage_id;
  const round_id = cupFixture.round_id;
  
  // For cups, we need to get stage info from the API call that includes stage data
  // For now, we'll infer from the fixture name or use basic info
  const match_info = {
    stage: stage_id ? {
      id: stage_id,
      name: 'Round 3', // This should come from included stage data
      type: 'cup'
    } : null,
    round: round_id ? {
      id: round_id,
      name: 'Round 3' // This should come from included round data
    } : null
  };

  // Build the normalized match document
  const normalizedMatch = {
    match_id: match_id,
    date: date,
    time: time,
    status: 'NS', // Cup fixtures usually start as Not Started
    competition_name: competition_name,
    competition_logo: competition_logo,
    league_id: league_id,
    season_id: cupFixture.season_id || null,
    
    teams: {
      home: {
        id: new mongoose.Types.ObjectId(), // We'll need to map to actual team records
        name: homeTeam.name || homeTeam.short_code || 'Unknown',
        logo: homeTeam.image_path || `https://cdn.sportmonks.com/images/soccer/teams/placeholder.png`,
        sportmonks_id: homeTeam.id
      },
      away: {
        id: new mongoose.Types.ObjectId(), // We'll need to map to actual team records  
        name: awayTeam.name || awayTeam.short_code || 'Unknown',
        logo: awayTeam.image_path || `https://cdn.sportmonks.com/images/soccer/teams/placeholder.png`,
        sportmonks_id: awayTeam.id
      }
    },

    match_info: match_info,
    
    venue: cupFixture.venue_id ? {
      id: cupFixture.venue_id,
      name: 'Stadium', // Would need venue include for actual name
      city: 'City'
    } : null,

    events: [],
    scores: {
      home: null,
      away: null
    },

    // Cup-specific fields
    leg: cupFixture.leg || '1/1',
    aggregate_id: cupFixture.aggregate_id || null,
    
    // Metadata
    created_at: new Date(),
    updated_at: new Date()
  };

  return normalizedMatch;
}

module.exports = {
  normaliseCupFixture,
  CUP_COMPETITIONS,
  STAGE_NAME_MAP
};