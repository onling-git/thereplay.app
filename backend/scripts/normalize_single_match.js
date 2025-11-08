#!/usr/bin/env node
// scripts/normalize_single_match.js
// Usage: node scripts/normalize_single_match.js <match_id> [mongoUri]

const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}
const mongoose = require('mongoose');
const Match = require('../models/Match');
const { parseProviderDate } = require('../utils/normaliseFixture');

const argv = require('minimist')(process.argv.slice(2));
const matchId = argv._[0] ? Number(argv._[0]) : null;
const uri = argv._[1] || process.env.MONGO_URI || process.env.DBURI || process.env.MONGO || null;

if (!matchId) {
  console.error('Please provide a match_id to normalize.');
  process.exit(2);
}
if (!uri) {
  console.error('Missing Mongo URI. Provide as second arg or set MONGO_URI/DBURI in env.');
  process.exit(2);
}

async function run() {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    const doc = await Match.findOne({ match_id: matchId }).lean();
    if (!doc) {
      console.error('No match found with id', matchId);
      process.exit(1);
    }

    let candidate = null;
    if (doc.match_info && doc.match_info.starting_at) candidate = doc.match_info.starting_at;
    else if (doc.date) candidate = doc.date;
    else if (doc.match_info && doc.match_info.starting_at_timestamp) candidate = Number(doc.match_info.starting_at_timestamp) * 1000;

    const parsed = parseProviderDate(candidate);
    if (!parsed) {
      console.error('Could not parse any date for match', matchId, 'candidate=', candidate);
      process.exit(1);
    }
    const ts = Math.floor(parsed.getTime() / 1000);

    const newMatchInfo = Object.assign({}, doc.match_info || {}, { starting_at: parsed, starting_at_timestamp: ts });
    const updates = { match_info: newMatchInfo, date: parsed };
    await Match.findOneAndUpdate({ match_id: matchId }, { $set: updates });
    console.log('[normalize] Updated match', matchId, 'to', parsed.toISOString(), ts);
    await mongoose.connection.close();
  } catch (e) {
    console.error('[normalize] Error', e.message || e);
    process.exit(1);
  }
}

run();
