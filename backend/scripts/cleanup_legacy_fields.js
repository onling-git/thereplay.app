#!/usr/bin/env node
// scripts/cleanup_legacy_fields.js
// Remove deprecated top-level fields from all Match documents and rewrite canonical fields

const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}
const connectDB = require('../db/connect');
const Match = require('../models/Match');

async function main() {
  const mongoUrl = process.env.DBURI || process.env.MONGO_URL || process.env.DBURI || 'mongodb://localhost:27017/thefinalplay';
  await connectDB(mongoUrl);

  const cursor = Match.find({}).cursor();
  let count = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    const unset = {};
    const keys = ['date','home_team','away_team','home_team_id','away_team_id','home_team_slug','away_team_slug','minute','time_added','status','status_code','report','player_ratings'];
    for (const k of keys) if (doc[k] !== undefined) unset[k] = "";
    if (Object.keys(unset).length) {
      await Match.updateOne({ _id: doc._id }, { $unset: unset });
      count++;
    }
  }
  console.log('cleaned', count, 'documents');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
