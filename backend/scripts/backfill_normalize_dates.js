#!/usr/bin/env node
// scripts/backfill_normalize_dates.js
// One-off script to normalize match start dates into canonical UTC Date and unix timestamp
// Usage: node scripts/backfill_normalize_dates.js [--dry] [--limit=N] [mongoUri]

const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}
const mongoose = require('mongoose');
const Match = require('../models/Match');
const { parseProviderDate } = require('../utils/normaliseFixture');

const argv = require('minimist')(process.argv.slice(2));
const dry = !!argv.dry;
const limit = Number(argv.limit) || 0;
const fromToday = !!argv['from-today'] || !!argv.fromToday;
const uri = argv._[0] || process.env.MONGO_URI || process.env.DBURI || process.env.MONGO || null;

if (!uri) {
  console.error('Missing Mongo URI. Provide as first arg or set MONGO_URI/DBURI in env.');
  process.exit(2);
}

async function normalizeOne(doc) {
  // Determine candidate from nested match_info, legacy date, or timestamp
  let candidate = null;
  if (doc.match_info && doc.match_info.starting_at) candidate = doc.match_info.starting_at;
  else if (doc.date) candidate = doc.date;
  else if (doc.match_info && doc.match_info.starting_at_timestamp) candidate = Number(doc.match_info.starting_at_timestamp) * 1000;

  const parsed = parseProviderDate(candidate);
  if (!parsed) return { updated: false, reason: 'no-parseable-date', parsed: null };

  const ts = Math.floor(parsed.getTime() / 1000);
  // Build a merged match_info object instead of setting both parent and child
  // fields in the same update (Mongo will error with a conflict if both are set).
  const existingMatchInfo = (doc.match_info && typeof doc.match_info === 'object') ? doc.match_info : {};
  const existingDate = existingMatchInfo.starting_at ? new Date(existingMatchInfo.starting_at) : null;
  const existingTs = existingMatchInfo.starting_at_timestamp != null ? Number(existingMatchInfo.starting_at_timestamp) : null;

  const needsDate = !existingDate || Math.abs(existingDate.getTime() - parsed.getTime()) > 1000;
  const needsTs = existingTs != null ? (existingTs !== ts) : true;

  if (!needsDate && !needsTs && doc.date && Math.abs(new Date(doc.date).getTime() - parsed.getTime()) <= 1000) {
    return { updated: false, reason: 'already-canonical' };
  }

  const newMatchInfo = Object.assign({}, existingMatchInfo, {});
  if (needsDate) newMatchInfo.starting_at = parsed;
  if (needsTs) newMatchInfo.starting_at_timestamp = ts;

  const updates = { 'match_info': newMatchInfo, 'date': parsed };

  if (!dry) {
    await Match.findOneAndUpdate({ _id: doc._id }, { $set: updates });
    return { updated: true, updates };
  }
  return { updated: true, updates, dry: true };
}

async function run() {
  try {
    await mongoose.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('[backfill] Connected to MongoDB');

    // Build query for likely-affected documents: missing ts or missing nested date
    const baseOr = [
      { 'match_info.starting_at': { $exists: false } },
      { 'match_info.starting_at_timestamp': { $exists: false } },
      { date: { $exists: false } }
    ];

    let q = { $or: baseOr };
    if (fromToday) {
      // midnight UTC today
      const now = new Date();
      const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
      // only consider matches starting at or after today's UTC midnight
      q = { $and: [ { $or: baseOr }, { $or: [ { 'match_info.starting_at': { $gte: utcMidnight } }, { date: { $gte: utcMidnight } }, { 'match_info.starting_at_timestamp': { $gte: Math.floor(utcMidnight.getTime() / 1000) } } ] } ] };
    }

    const cursor = Match.find(q).lean().cursor();
    let count = 0;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      const res = await normalizeOne(doc);
      count += 1;
      console.log(`[backfill] doc ${doc.match_id} =>`, res);
      if (limit && count >= limit) break;
    }

    console.log('[backfill] Done. Processed', count, 'docs. dry=', !!dry);
    await mongoose.connection.close();
  } catch (e) {
    console.error('[backfill] Error', e.message || e);
    process.exit(1);
  }
}

run();
