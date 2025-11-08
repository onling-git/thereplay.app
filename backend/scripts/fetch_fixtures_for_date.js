#!/usr/bin/env node
// scripts/fetch_fixtures_for_date.js
// Pull all fixtures for a given UTC date and store them in Matches collection.
// Usage: node scripts/fetch_fixtures_for_date.js [--date=YYYY-MM-DD] [--dry] [--mock] [--mongoUrl=uri]

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const argv = require('minimist')(process.argv.slice(2));
const { get: smGet } = require('../utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
const { enrichFixtureRelated } = require('../controllers/syncController');
const { connectDB, closeDB } = require('../db/connect');
const Match = require('../models/Match');
const fs = require('fs');

const dry = !!argv.dry;
const mock = !!argv.mock;
const inspectFirst = !!argv['inspect-first'];
const printRawFirst = !!argv['print-raw-first'];
const mongoUrl = argv.mongoUrl || process.env.MONGO_URL || process.env.DBURI || process.env.MONGODB_URI || process.env.MONGO || 'mongodb://localhost:27017/thefinalplay';

function ymd(d){
  const pad = (n) => String(n).padStart(2,'0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;
}

async function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchFromProvider(date){
  const include = 'events;participants;scores;periods;state';
  return await smGet(`/fixtures/date/${date}`, { include });
}

async function main(){
  // determine date (UTC)
  let dateArg = argv.date;
  if (!dateArg) dateArg = ymd(new Date());

  console.log(`Fetching fixtures for date ${dateArg} (dry=${dry}, mock=${mock})`);

  if (!dry) {
    console.log('Connecting to MongoDB at', mongoUrl);
    await connectDB(mongoUrl);
  }

  let fixtures = [];

  if (mock) {
    // try to load any tmp fixture files as a convenience for offline testing
    const tmpDir = path.resolve(__dirname, '..', 'tmp');
    try {
      const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.json'));
      for (const f of files) {
        try {
          const p = JSON.parse(fs.readFileSync(path.join(tmpDir, f), 'utf8'));
          fixtures.push(p);
        } catch (e) { /* ignore parse errors */ }
      }
      console.log('Loaded', fixtures.length, 'fixtures from tmp for mock mode');
    } catch (e) {
      console.warn('Mock mode: failed to read tmp dir', e?.message || e);
    }
  } else {
    try {
      const res = await fetchFromProvider(dateArg);
      fixtures = Array.isArray(res?.data?.data) ? res.data.data : (Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      console.error('Failed to fetch fixtures:', e?.response?.data || e?.message || e);
      process.exit(1);
    }
  }

  console.log('Total fixtures fetched:', fixtures.length);

  let upserted = 0;
  const matchIds = [];

  for (const fx of fixtures) {
    try {
      // optionally print the raw first fetched fixture for debugging
      if (dry && printRawFirst && matchIds.length === 0) {
        console.log('--- RAW FIRST FIXTURE PAYLOAD ---');
        try { console.log(JSON.stringify(fx, null, 2)); } catch (e) { console.log(fx); }
      }

      // Enrich related objects (venue/referee/season/league) by fetching them if missing
      try {
        await enrichFixtureRelated(fx);
      } catch (e) {
        console.warn('Enrichment failed for fixture', fx?.id || fx?.fixture_id || '(unknown)', e?.message || e);
      }

      const doc = normaliseFixtureToMatchDoc(fx);
      if (!doc) continue;
      // optionally print the first normalized doc for inspection
      if (dry && inspectFirst && matchIds.length === 0) {
        console.log('--- INSPECT FIRST NORMALISED DOC ---');
        console.log(JSON.stringify(doc, null, 2));
      }
      // ensure slugs
      if (doc.home_team) doc.home_team_slug = doc.home_team_slug || String(doc.home_team).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
      if (doc.away_team) doc.away_team_slug = doc.away_team_slug || String(doc.away_team).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');

      if (!dry) {
        // Strip undefined fields from doc to avoid unintentionally overwriting existing DB fields
        const cleaned = {};
        for (const k of Object.keys(doc)) {
          if (doc[k] !== undefined) cleaned[k] = doc[k];
        }
        await Match.findOneAndUpdate({ match_id: doc.match_id }, { $set: cleaned }, { upsert: true, new: true });
        upserted++;
        matchIds.push(doc.match_id);
      } else {
        console.log('(dry) would upsert', doc.match_id, doc.home_team, 'v', doc.away_team);
      }
    } catch (e) {
      console.error('Upsert failed for fixture', fx?.id || fx?.fixture_id || '(unknown)', e?.message || e);
    }
    // be polite to provider
    if (!mock) await sleep(80);
  }

  console.log(`Done. upserted=${upserted} (dry=${dry})`);
  if (matchIds.length) console.log('match_ids:', matchIds.slice(0,200));

  if (!dry) {
    await sleep(50);
    try { await closeDB(); } catch (e) {}
  }

  process.exit(0);
}

main().catch(e => { console.error('Script failed', e?.message || e); process.exit(1); });
