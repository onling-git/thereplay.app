#!/usr/bin/env node
// scripts/backfill_events_ft.js
// Backfill events for matches that are finished (FT) but missing events
// Usage: node scripts/backfill_events_ft.js [--limit=N] [--delay=ms] [--dry]

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const connectDB = require('../db/connect');
const Match = require('../models/Match');
const { get: smGet } = require('../utils/sportmonks');
const argv = require('minimist')(process.argv.slice(2));

const limit = Number(argv.limit) || 0;
const dry = !!argv.dry;
const delay = Number(argv.delay) || 150;
const mongoUrl = process.env.MONGO_URL || process.env.DBURI || process.env.MONGODB_URI || process.env.MONGO || 'mongodb://localhost:27017/thefinalplay';

function sleep(ms){ return new Promise(r => setTimeout(r, ms)); }

async function fetchFixtureEvents(id){
  try{
    const res = await smGet(`fixtures/${id}`, { include: 'events;participants;scores;periods' });
    const payload = res?.data?.data || res?.data;
    if (!payload) return null;
    const events = payload.events?.data || payload.events || [];
    return { events, raw: payload };
  }catch(e){
    const code = e?.response?.data?.code;
    if (code === 5001) {
      const res2 = await smGet(`fixtures/${id}`);
      const payload2 = res2?.data?.data || res2?.data;
      const events2 = payload2?.events?.data || payload2?.events || [];
      return { events: events2, raw: payload2 };
    }
    console.warn('fetchFixtureEvents failed for', id, e?.response?.data || e?.message || e);
    return null;
  }
}

async function main(){
  console.log('connecting to', mongoUrl);
  await connectDB(mongoUrl);

  const finishedStates = ['FT','FTP','FT_PEN','FT_P','AET'];
  const q = { 'match_status.short_name': { $in: finishedStates }, $or: [ { events: { $exists: false } }, { 'events.0': { $exists: false } }, { events: { $size: 0 } } ] };
  const cursor = Match.find(q).sort({ date: -1 }).cursor();

  let processed = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()){
    if (limit && processed >= limit) break;
    const id = Number(doc.match_id);
    if (!Number.isFinite(id)) continue;
    console.log('Processing FT match', id);
    try{
      const fetched = await fetchFixtureEvents(id);
      if (!fetched) {
        console.log('No fixture data for', id);
      } else {
        const events = Array.isArray(fetched.events) ? fetched.events : [];
        console.log('Fetched events count', events.length);
        if (!dry) {
          await Match.updateOne({ _id: doc._id }, { $set: { events } });
          console.log('Updated', id);
        } else {
          console.log('(dry) would update', id);
        }
      }
    }catch(e){
      console.error('Failed', id, e?.message || e);
    }
    processed++;
    if (delay > 0) await sleep(delay);
  }

  console.log('Done, processed', processed);
  process.exit(0);
}

main().catch(e => { console.error('Script failed', e); process.exit(1); });
