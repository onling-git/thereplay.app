#!/usr/bin/env node
/**
 * Reset Match to Not Started
 * 
 * This script resets a match back to "Not Started" state for testing.
 * Clears scores, events, and statistics.
 * 
 * Usage:
 *   node scripts/reset_match.js <match_id>
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');

async function resetMatch(matchId) {
  try {
    if (!matchId) {
      console.log('❌ Usage: node scripts/reset_match.js <match_id>');
      process.exit(1);
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.DBURI || process.env.MONGO_URI);
    console.log('✅ Connected!\n');

    const match = await Match.findOne({ match_id: matchId });
    
    if (!match) {
      console.log(`❌ Match ${matchId} not found`);
      process.exit(1);
    }

    console.log(`🏟️  Resetting: ${match.home_team || match.teams?.home?.team_name} vs ${match.away_team || match.teams?.away?.team_name}`);
    console.log(`📊 Current Status: ${match.match_status?.state || 'NS'}\n`);

    // Reset to not started
    await Match.updateOne(
      { match_id: matchId },
      {
        $set: {
          'match_status.id': 1,
          'match_status.state': 'NS',
          'match_status.name': 'Not Started',
          'match_status.short_name': 'NS',
          'match_status.developer_name': 'NS',
          'score.home': 0,
          'score.away': 0,
          'score.ht_score': null,
          'score.ft_score': null,
          events: [],
          statistics: {},
          'match_info.minute': null,
          comments: []
        }
      }
    );

    console.log('✅ Match reset to Not Started state!\n');
    console.log('🧪 Ready for testing with:');
    console.log(`   node scripts/simulate_live_match.js ${matchId}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

const matchId = process.argv[2] ? parseInt(process.argv[2]) : null;
resetMatch(matchId);
