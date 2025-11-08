#!/usr/bin/env node
// scripts/backfill_match_status.js
// Usage: node scripts/backfill_match_status.js [--limit=N] [--dry]

const path = require('path');
// load .env from backend/.env if present so users don't need to export manually
try {
  require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
} catch (e) {
  // ignore if dotenv not available or .env missing
}
const mongoose = require('mongoose');
const connectDB = require('../db/connect');
const Match = require('../models/Match');
// import sportmonks helper after dotenv so process.env.SPORTMONKS_API_KEY is available
const { get: smGet } = require('../utils/sportmonks');

const argv = require('minimist')(process.argv.slice(2));
const limit = Number(argv.limit) || 0;
const dry = !!argv.dry;
const singleMatchId = argv.matchId || argv.matchId === 0 ? Number(argv.matchId) : null;
const mongoFromArg = argv.mongo || argv.MONGO || null;
const throttleMs = Number(argv.throttle) || Number(process.env.BACKFILL_THROTTLE_MS) || 150;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function buildMatchStatusFromFixture(fixture) {
  if (!fixture) return { id: null, state: '', name: '', short_name: '', developer_name: '' };
  if (fixture.state && Object.keys(fixture.state).length) return fixture.state;
  if (fixture.status && Object.keys(fixture.status).length) return fixture.status;
  if (fixture.time && (fixture.time.status || fixture.time.status_code)) {
    return {
      id: null,
      state: fixture.time.status || '',
      name: fixture.time.status || '',
      short_name: fixture.time.status_code || '',
      developer_name: ''
    };
  }
  return { id: null, state: '', name: '', short_name: '', developer_name: '' };
}

async function fetchCanonicalStateIfConfigured(id) {
  if (!id) return null;
  if (!process.env.SPORTMONKS_FETCH_STATE) return null;
  try {
    const res = await smGet(`states/${id}`);
    const payload = res?.data?.data || res?.data;
    return payload || null;
  } catch (e) {
    console.warn('states fetch failed for', id, e?.response?.data || e?.message || e);
    return null;
  }
}

async function main() {
  const mongoUrl = mongoFromArg || process.env.MONGO_URL || process.env.MONGODB_URI || process.env.DBURI || 'mongodb://localhost:27017/thefinalplay';
  console.log('connecting to', mongoUrl);
  await connectDB(mongoUrl);

  let cursor;
  if (singleMatchId && Number.isFinite(singleMatchId)) {
    console.log('Running for single matchId:', singleMatchId);
    const doc = await Match.findOne({ match_id: singleMatchId }).lean();
    if (!doc) {
      console.warn('No match document found with match_id', singleMatchId);
      console.log('Tip: provide --mongo "mongodb://..." to point to a different DB');
      process.exit(0);
    }
    // simple iterator with a next() that returns the doc once, then null
    let returned = false;
    cursor = {
      next: async () => {
        if (!returned) {
          returned = true;
          return doc;
        }
        return null;
      }
    };
  } else {
    // Build query: match documents where match_status.short_name is missing or empty
    const q = { $or: [ { 'match_status': { $exists: false } }, { 'match_status.short_name': { $in: [null, ''] } }, { 'match_status.name': { $in: [null, ''] } } ] };
    cursor = Match.find(q).cursor();
  }
  let count = 0;
  // iterate using cursor.next() aware of both cursor types
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    if (limit && count >= limit) break;
    const fixtureId = Number(doc.match_id);
    if (!Number.isFinite(fixtureId)) {
      console.warn('Skipping doc without numeric match_id:', doc._id);
      continue;
    }
    console.log('Processing match', fixtureId);
    try {
      let res;
      try {
        // request the fixture with its state object when possible (per API docs)
        res = await smGet(`fixtures/${fixtureId}`, { include: 'state' });
      } catch (e) {
        // SportMonks sometimes rejects unknown includes for certain plans.
        // If the error indicates include is invalid, retry without includes.
        const code = e?.response?.data?.code;
        if (code === 5001 || /requested include.*does not exist/i.test(String(e?.response?.data?.message || ''))) {
          console.warn('Include rejected by SportMonks (state), retrying without include for', fixtureId);
          res = await smGet(`fixtures/${fixtureId}`);
        } else {
          throw e;
        }
      }
      const fixture = res?.data?.data || res?.data || null;
      let ms = await buildMatchStatusFromFixture(fixture);
      // If SportMonks explicitly returned a "no results" message, mark the doc
      // so we know the provider had no data for this fixture (prevents repeated
      // re-tries and makes the empty state explicit).
      const apiMessage = res?.data?.message || '';
      if (apiMessage && /no result/i.test(apiMessage)) {
        ms = {
          id: null,
          state: '',
          name: '',
          short_name: '',
          developer_name: '',
          provider_missing: true,
          provider_message: String(apiMessage).slice(0, 1024)
        };
      }
      // if fixture suggests a state id and configured, fetch canonical
      const provStateId = fixture?.state?.id || fixture?.state_id || fixture?.time?.status_id || null;
      if (provStateId) {
        const canonical = await fetchCanonicalStateIfConfigured(provStateId);
        if (canonical) {
          ms = {
            id: canonical.id ?? provStateId,
            state: canonical.state ?? canonical.short_name ?? canonical.name ?? '',
            name: canonical.name ?? canonical.state ?? '',
            short_name: canonical.short_name ?? canonical.state ?? '',
            developer_name: canonical.developer_name ?? ''
          };
        }
      }

      console.log('Derived match_status:', ms);
      if (!dry) {
        await Match.updateOne({ _id: doc._id }, { $set: { match_status: ms } });
        console.log('Updated', fixtureId);
      } else {
        console.log('(dry run) would update', fixtureId);
      }
    } catch (e) {
      console.error('Failed to process', fixtureId, e?.response?.data || e?.message || e);
    }
    // throttle between successive SportMonks calls to reduce 429s
    if (throttleMs > 0) await sleep(throttleMs);
    count++;
  }

  console.log('Done, processed', count, `(throttle ${throttleMs}ms)`);
  process.exit(0);
}

main().catch(e => {
  console.error('Script failed', e);
  process.exit(1);
});
