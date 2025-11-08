#!/usr/bin/env node
// scripts/inspect_match_dates.js
// Usage: node scripts/inspect_match_dates.js <match_id> [mongoUri]

const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}
const mongoose = require('mongoose');
const Match = require('../models/Match');

async function run() {
  const matchId = process.argv[2] ? Number(process.argv[2]) : null;
  const uri = process.argv[3] || process.env.MONGO_URI || process.env.DBURI || process.env.MONGO || null;
  if (!matchId) {
    console.error('Please provide a match_id to inspect.');
    process.exit(2);
  }
  if (!uri) {
    console.error('Missing Mongo URI. Provide as second arg or set MONGO_URI/DBURI in env.');
    process.exit(2);
  }
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const m = await Match.findOne({ match_id: matchId }).lean();
    if (!m) {
      console.log('No match found with match_id', matchId);
      process.exit(0);
    }
    console.log('match_id:', m.match_id);
    console.log('top-level date (raw):', m.date);
    console.log('top-level date (toISOString):', m.date ? new Date(m.date).toISOString() : null);
    console.log('match_info.starting_at (raw):', m.match_info && m.match_info.starting_at);
    console.log('match_info.starting_at (toISOString):', m.match_info && m.match_info.starting_at ? new Date(m.match_info.starting_at).toISOString() : null);
    console.log('match_info.starting_at_timestamp:', m.match_info && m.match_info.starting_at_timestamp);
    console.log('stored timezone offset (example): new Date().getTimezoneOffset() (minutes):', new Date().getTimezoneOffset());
    console.log('full doc preview (match_info + date):', JSON.stringify({ date: m.date, match_info: m.match_info }, null, 2));
    await mongoose.connection.close();
  } catch (e) {
    console.error('Error inspecting match:', e.message || e);
    process.exit(1);
  }
}

run();
