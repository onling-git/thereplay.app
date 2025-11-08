#!/usr/bin/env node
// scripts/list_matches.js
const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}
const connectDB = require('../db/connect');
const Match = require('../models/Match');

async function main() {
  const mongoUrl = process.env.DBURI || process.env.MONGO_URL || process.env.DBURI || 'mongodb://localhost:27017/thefinalplay';
  await connectDB(mongoUrl);
  const docs = await Match.find({}).sort({ updatedAt: -1 }).limit(20).lean();
  console.log('found', docs.length);
  for (const d of docs) {
    console.log(d.match_id, d.teams?.home?.team_name, 'vs', d.teams?.away?.team_name, 'lineup:', (d.lineup?.home||[]).length, (d.lineup?.away||[]).length);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
