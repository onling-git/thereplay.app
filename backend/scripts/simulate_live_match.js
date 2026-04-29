#!/usr/bin/env node
/**
 * Simulate Live Match Testing Tool
 * 
 * This script simulates a live match by:
 * 1. Finding a match scheduled for today
 * 2. Updating its status to LIVE
 * 3. Adding random goals, cards, and statistics
 * 4. Can be run multiple times to simulate match progression
 * 
 * Usage:
 *   node scripts/simulate_live_match.js [match_id]
 *   
 * If no match_id provided, it will pick the first upcoming match today
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');

const LIVE_STATES = ['LIVE', 'HT', 'BREAK', 'ET', 'PEN_LIVE'];
const GOAL_TYPES = ['goal', 'penalty', 'own-goal', 'header'];
const CARD_TYPES = ['yellowcard', 'redcard', 'yellowred'];

async function simulateLiveMatch(matchId) {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.DBURI || process.env.MONGO_URI);
    console.log('✅ Connected!\n');

    let match;
    
    if (matchId) {
      // Use provided match ID
      match = await Match.findOne({ match_id: matchId });
      if (!match) {
        console.log(`❌ Match ${matchId} not found`);
        process.exit(1);
      }
    } else {
      // Find next upcoming match today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      match = await Match.findOne({
        date: { $gte: today, $lt: tomorrow },
        'match_status.state': { $nin: ['FT', 'FT_PEN', 'AET', 'CANCL', 'POSTP', 'ABAN'] }
      }).sort({ date: 1 });

      if (!match) {
        console.log('❌ No upcoming matches found for today');
        process.exit(1);
      }
    }

    console.log(`🏟️  Simulating live match: ${match.home_team || match.teams?.home?.team_name} vs ${match.away_team || match.teams?.away?.team_name}`);
    console.log(`🆔 Match ID: ${match.match_id}`);
    console.log(`📊 Current Status: ${match.match_status?.state || 'NS'}\n`);

    // Generate random match state
    const isCurrentlyLive = LIVE_STATES.includes(match.match_status?.state);
    const newState = isCurrentlyLive 
      ? (Math.random() > 0.7 ? 'HT' : 'LIVE') // If already live, might go to HT
      : LIVE_STATES[Math.floor(Math.random() * 2)]; // New live match: LIVE or HT

    // Generate random scores
    const currentHomeScore = match.score?.home || 0;
    const currentAwayScore = match.score?.away || 0;
    
    const homeScore = currentHomeScore + Math.floor(Math.random() * 2); // 0-1 new goals
    const awayScore = currentAwayScore + Math.floor(Math.random() * 2);

    // Generate random minute
    const minute = newState === 'HT' 
      ? 45 
      : Math.floor(Math.random() * 90) + 1;

    // Create new events if score changed
    const newEvents = [];
    const existingEvents = match.events || [];
    
    // Add goals if score increased
    for (let i = currentHomeScore; i < homeScore; i++) {
      newEvents.push({
        type_id: 14, // Goal
        type: 'goal',
        sub_type: GOAL_TYPES[Math.floor(Math.random() * GOAL_TYPES.length)],
        team_id: match.home_team_id || match.teams?.home?.team_id,
        team_name: match.home_team || match.teams?.home?.team_name,
        player_name: `Player ${Math.floor(Math.random() * 11) + 1}`,
        minute: Math.floor(Math.random() * 90) + 1,
        result: `${i + 1}-${awayScore}`
      });
    }

    for (let i = currentAwayScore; i < awayScore; i++) {
      newEvents.push({
        type_id: 14,
        type: 'goal',
        sub_type: GOAL_TYPES[Math.floor(Math.random() * GOAL_TYPES.length)],
        team_id: match.away_team_id || match.teams?.away?.team_id,
        team_name: match.away_team || match.teams?.away?.team_name,
        player_name: `Player ${Math.floor(Math.random() * 11) + 1}`,
        minute: Math.floor(Math.random() * 90) + 1,
        result: `${homeScore}-${i + 1}`
      });
    }

    // Random cards
    if (Math.random() > 0.5) {
      const cardType = CARD_TYPES[Math.floor(Math.random() * CARD_TYPES.length)];
      newEvents.push({
        type_id: cardType === 'yellowcard' ? 17 : 18,
        type: cardType,
        team_id: Math.random() > 0.5 ? match.home_team_id : match.away_team_id,
        team_name: Math.random() > 0.5 ? match.home_team : match.away_team,
        player_name: `Player ${Math.floor(Math.random() * 11) + 1}`,
        minute: Math.floor(Math.random() * 90) + 1
      });
    }

    // Random statistics
    const statistics = {
      possession: {
        home: 45 + Math.floor(Math.random() * 20),
        away: null // Will calculate
      },
      shots_total: {
        home: homeScore + Math.floor(Math.random() * 10),
        away: awayScore + Math.floor(Math.random() * 10)
      },
      shots_on_target: {
        home: homeScore + Math.floor(Math.random() * 5),
        away: awayScore + Math.floor(Math.random() * 5)
      },
      corners: {
        home: Math.floor(Math.random() * 8),
        away: Math.floor(Math.random() * 8)
      },
      fouls: {
        home: Math.floor(Math.random() * 15),
        away: Math.floor(Math.random() * 15)
      }
    };
    statistics.possession.away = 100 - statistics.possession.home;

    // Update the match
    const updateData = {
      'match_status.state': newState,
      'match_status.name': newState === 'LIVE' ? 'In Play' : 'Half Time',
      'match_status.short_name': newState,
      'score.home': homeScore,
      'score.away': awayScore,
      'score.ht_score': newState === 'HT' ? `${homeScore}-${awayScore}` : match.score?.ht_score,
      events: [...existingEvents, ...newEvents],
      statistics: statistics,
      'match_info.minute': minute
    };

    await Match.updateOne(
      { match_id: match.match_id },
      { $set: updateData }
    );

    console.log('✅ Match updated to simulate live state!\n');
    console.log('📊 Updated Details:');
    console.log(`   State: ${newState}`);
    console.log(`   Score: ${homeScore} - ${awayScore}`);
    console.log(`   Minute: ${minute}'`);
    console.log(`   New Events: ${newEvents.length}`);
    console.log(`   Possession: ${statistics.possession.home}% - ${statistics.possession.away}%`);
    console.log(`   Shots: ${statistics.shots_total.home} - ${statistics.shots_total.away}\n`);

    console.log('🧪 To test:');
    console.log(`   1. Check your frontend live match view`);
    console.log(`   2. Run: node scripts/check_match_detail.js (to inspect DB)`);
    console.log(`   3. Run this script again to simulate progression\n`);

    console.log('🔄 To reset match to not started:');
    console.log(`   node scripts/reset_match.js ${match.match_id}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

// Get match ID from command line or use null to auto-select
const matchId = process.argv[2] ? parseInt(process.argv[2]) : null;

simulateLiveMatch(matchId);
