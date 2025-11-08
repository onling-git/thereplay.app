#!/usr/bin/env node
// scripts/print_match_clean.js
// Print a Match document by match_id (clean copy)

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const argv = require('minimist')(process.argv.slice(2));
const { connectDB, closeDB } = require('../db/connect');
const Match = require('../models/Match');

const id = Number(argv._[0] || argv.id);
if (!id) {
  console.error('Usage: node scripts/print_match_clean.js <match_id>');
  process.exit(1);
}

async function run(){
  const mongoUrl = process.env.MONGO_URL || process.env.DBURI || process.env.MONGODB_URI || process.env.MONGO || 'mongodb://localhost:27017/thefinalplay';
  await connectDB(mongoUrl);
  try {
    const doc = await Match.findOne({ match_id: id }).lean();
    if (!doc) {
      console.log('No match found for', id);
    } else {
      console.log(JSON.stringify(doc, null, 2));
    }
  } catch (e) {
    console.error('Error reading match', e?.message || e);
  } finally {
    try { await closeDB(); } catch (e) {}
    process.exit(0);
  }
}

run().catch(e => { console.error('Script failed', e?.message || e); process.exit(1); });
