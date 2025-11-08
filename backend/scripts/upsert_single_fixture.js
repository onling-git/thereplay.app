#!/usr/bin/env node
// scripts/upsert_single_fixture.js
// Fetch a single fixture by id, enrich, normalise and upsert into Matches collection.

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const argv = require('minimist')(process.argv.slice(2));
const { get: smGet } = require('../utils/sportmonks');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
const { enrichFixtureRelated } = require('../controllers/syncController');
const { connectDB, closeDB } = require('../db/connect');
const Match = require('../models/Match');

const id = argv._[0] || argv.id;
if (!id) {
  console.error('Usage: node scripts/upsert_single_fixture.js <fixture_id>');
  process.exit(1);
}

async function run(){
  const mongoUrl = process.env.MONGO_URL || process.env.DBURI || process.env.MONGODB_URI || process.env.MONGO || 'mongodb://localhost:27017/thefinalplay';
  console.log('Connecting to MongoDB at', mongoUrl);
  await connectDB(mongoUrl);

  try {
    console.log('[sportmonks] GET fixture', id);
  // Request participants/events/periods/state so normaliser has team and state data
  const include = 'events;participants;scores;periods;state';
    let res = await smGet(`/fixtures/${id}`, { include });
    let fx = res?.data?.data || res?.data;
    // If the single-fixture response lacks participants, try the date listing which often includes participants
    const needsParticipants = !fx || !Array.isArray(fx.participants) || fx.participants.length === 0;
    if (needsParticipants) {
      const starting = fx?.starting_at || fx?.starting_at_timestamp;
      if (starting) {
        const ymd = (d) => { const pad = n => String(n).padStart(2,'0'); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`; };
        const dateArg = typeof starting === 'number' ? ymd(new Date(starting*1000)) : ymd(new Date(starting + 'Z'));
        console.log('[sportmonks] Single fixture missing participants, fetching fixtures for date', dateArg);
        try {
          const listRes = await smGet(`/fixtures/date/${dateArg}`, { include });
          const list = Array.isArray(listRes?.data?.data) ? listRes.data.data : (Array.isArray(listRes?.data) ? listRes.data : []);
          const found = list.find(f => Number(f.id) === Number(id));
          if (found) {
            console.log('[sportmonks] Found fixture in date list with participants, using that payload');
            fx = found;
          } else {
            console.warn('[sportmonks] Fixture not found in date list or still missing participants');
          }
        } catch (e) {
          console.warn('Failed to fetch fixtures by date for enrichment', e?.message || e);
        }
      }
    }
    if (!fx) throw new Error('No fixture returned from provider');

    console.log('Enriching fixture...');
    try { await enrichFixtureRelated(fx); } catch (e) { console.warn('Enrichment failed', e?.message||e); }

    const doc = normaliseFixtureToMatchDoc(fx);
    if (!doc) throw new Error('Normalisation returned empty doc');
  console.log('Normalized doc (truncated):', JSON.stringify(doc, null, 2));

    console.log('Upserting...');
    // strip undefined before upsert so we don't clobber existing DB values with undefined
    const cleaned = {};
    for (const k of Object.keys(doc)) {
      if (doc[k] !== undefined) cleaned[k] = doc[k];
    }
    await Match.findOneAndUpdate({ match_id: doc.match_id }, { $set: cleaned }, { upsert: true, new: true });
    console.log('Upsert complete for', doc.match_id);
  } catch (e) {
    console.error('Failed:', e?.response?.data || e?.message || e);
  } finally {
    try { await closeDB(); } catch (e) {}
    process.exit(0);
  }
}

run().catch(e => { console.error('Script failed', e?.message || e); process.exit(1); });
