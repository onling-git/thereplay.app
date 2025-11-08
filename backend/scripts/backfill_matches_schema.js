#!/usr/bin/env node
// scripts/backfill_matches_schema.js
// Usage:
//   node scripts/backfill_matches_schema.js [--limit=N] [--dry] [--matchId=12345] [--mongo="mongodb://..."]
//
// This script normalizes Match documents to match the `Match` model in `models/Match.js`.
// It performs the following safe migrations:
// - Ensures `home_team_slug` and `away_team_slug` exist (slugify)
// - Ensures `teams.home` and `teams.away` objects are populated from existing fields
//   (`home_team`, `home_team_id`, `home_team_slug`, etc.)
// - Cleans `events` entries to include expected fields (coerce types, fill missing properties)
// - Ensures `score.home` and `score.away` are numbers (default 0)
// - Ensures `minute` and `added_time` are numeric or null
// - Removes known deprecated fields: `status`, `status_code`
// - Removes `player_ratings` when it's an empty array, and `report` when empty string
//
// The script supports `--dry` to only print planned updates without applying them.

const path = require('path');
try { require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') }); } catch (e) {}
const { connectDB } = require('../db/connect');
const Match = require('../models/Match');
const argv = require('minimist')(process.argv.slice(2));

const limit = Number(argv.limit) || 0;
const dry = !!argv.dry;
const singleMatchId = argv.matchId || argv.matchId === 0 ? Number(argv.matchId) : null;
const mongoFromArg = argv.mongo || argv.MONGO || null;

function slugify(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function cleanEvent(e) {
  // produce a normalized event object based on schema
  const ev = {};
  // numeric/id fields
  ev.id = e && e.id != null ? Number(e.id) : null;
  ev.fixture_id = e && e.fixture_id != null ? Number(e.fixture_id) : null;
  ev.period_id = e && e.period_id != null ? Number(e.period_id) : null;
  ev.detailed_period_id = e && e.detailed_period_id != null ? Number(e.detailed_period_id) : null;
  ev.participant_id = e && e.participant_id != null ? Number(e.participant_id) : null;

  ev.minute = (e && e.minute != null && !Number.isNaN(Number(e.minute))) ? Number(e.minute) : null;
  ev.extra_minute = (e && e.extra_minute != null && !Number.isNaN(Number(e.extra_minute))) ? Number(e.extra_minute) : null;

  // type mapping
  ev.type_id = e && e.type_id != null ? Number(e.type_id) : (e && e.type && e.type.id != null ? Number(e.type.id) : null);
  ev.type = '';
  // canonical mapping table (kept in sync with utils)
  const EVENT_TYPE_MAP = {
    10: 'VAR', 14: 'GOAL', 15: 'OWNGOAL', 16: 'PENALTY', 17: 'MISSED_PENALTY', 18: 'SUBSTITUTION',
    19: 'YELLOWCARD', 20: 'REDCARD', 21: 'YELLOWREDCARD', 22: 'PENALTY_SHOOTOUT_MISS', 23: 'PENALTY_SHOOTOUT_GOAL'
  };
  if (ev.type_id != null && EVENT_TYPE_MAP[ev.type_id]) ev.type = EVENT_TYPE_MAP[ev.type_id];
  else if (e && e.type) ev.type = String(e.type.name || e.type || e.type_name || '').toUpperCase().replace(/\s+/g,'_');

  ev.sub_type_id = e && e.sub_type_id != null ? Number(e.sub_type_id) : (e && e.subtype && e.subtype.id != null ? Number(e.subtype.id) : null);
  ev.sub_type = e && (e.sub_type || (e.subtype && e.subtype.name)) ? String(e.sub_type || e.subtype.name).trim() : '';

  // players and names
  ev.player_id = e && e.player_id != null && !Number.isNaN(Number(e.player_id)) ? Number(e.player_id) : (e && e.player && e.player.id != null ? Number(e.player.id) : null);
  ev.player_name = e && (e.player_name || (e.player && e.player.name)) ? String(e.player_name || e.player.name).trim() : '';
  ev.related_player_id = e && e.related_player_id != null && !Number.isNaN(Number(e.related_player_id)) ? Number(e.related_player_id) : (e && e.related_player && e.related_player.id != null ? Number(e.related_player.id) : null);
  ev.related_player_name = e && (e.related_player_name || (e.related_player && e.related_player.name)) ? String(e.related_player_name || e.related_player.name).trim() : '';

  // flags
  // preserve null/undefined as null for tri-state
  ev.injured = (e && (e.injured === true || e.injured === 1)) ? true : (e && (e.injured === false || e.injured === 0) ? false : null);
  ev.on_bench = (e && (e.on_bench === true || e.on_bench === 1)) ? true : (e && (e.on_bench === false || e.on_bench === 0) ? false : null);
  ev.coach_id = e && e.coach_id != null && !Number.isNaN(Number(e.coach_id)) ? Number(e.coach_id) : null;
  ev.sort_order = e && e.sort_order != null && !Number.isNaN(Number(e.sort_order)) ? Number(e.sort_order) : null;

  // textual fields and misc
  ev.team = e && e.team ? String(e.team).trim() : '';
  ev.result = (e && (e.result !== undefined && e.result !== null)) ? String(e.result) : null;
  ev.info = e && (e.info || e.details || e.reason) ? String(e.info || e.details || e.reason).trim() : '';
  ev.addition = e && e.addition ? String(e.addition).trim() : '';
  ev.rescinded = e && (e.rescinded === true || e.rescinded === 1) ? true : false;
  return ev;
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
      process.exit(0);
    }
    let returned = false;
    cursor = {
      next: async () => {
        if (!returned) { returned = true; return doc; }
        return null;
      }
    };
  } else {
    cursor = Match.find({}).cursor();
  }

  let count = 0;
  for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
    if (limit && count >= limit) break;
    const updates = {};
    const unset = {};

    // slugs
    if (!doc.home_team_slug && doc.home_team) updates.home_team_slug = slugify(doc.home_team);
    if (!doc.away_team_slug && doc.away_team) updates.away_team_slug = slugify(doc.away_team);

    // teams nested object
    updates['teams'] = updates['teams'] || {};
    updates.teams.home = updates.teams.home || {};
    updates.teams.away = updates.teams.away || {};

    updates.teams.home.team_name = doc.home_team || (doc.teams && doc.teams.home && doc.teams.home.team_name) || '';
    updates.teams.home.team_id = (doc.home_team_id != null) ? doc.home_team_id : (doc.teams && doc.teams.home && doc.teams.home.team_id) || null;
    updates.teams.home.team_slug = doc.home_team_slug || (doc.teams && doc.teams.home && doc.teams.home.team_slug) || '';

    updates.teams.away.team_name = doc.away_team || (doc.teams && doc.teams.away && doc.teams.away.team_name) || '';
    updates.teams.away.team_id = (doc.away_team_id != null) ? doc.away_team_id : (doc.teams && doc.teams.away && doc.teams.away.team_id) || null;
    updates.teams.away.team_slug = doc.away_team_slug || (doc.teams && doc.teams.away && doc.teams.away.team_slug) || '';

    // score
    const score = doc.score || {};
    updates.score = {
      home: (score.home != null && !Number.isNaN(Number(score.home))) ? Number(score.home) : 0,
      away: (score.away != null && !Number.isNaN(Number(score.away))) ? Number(score.away) : 0
    };

    // minute and added_time
    updates.minute = (doc.minute != null && !Number.isNaN(Number(doc.minute))) ? Number(doc.minute) : null;
    updates.added_time = (doc.added_time != null && !Number.isNaN(Number(doc.added_time))) ? Number(doc.added_time) : null;

    // events cleanup
    if (Array.isArray(doc.events)) {
      const cleaned = doc.events.map(cleanEvent);
      updates.events = cleaned;
    }

    // remove deprecated fields
    if (doc.status !== undefined) unset.status = '';
    if (doc.status_code !== undefined) unset.status_code = '';

    // remove empty arrays/strings that are no longer used
    if (Array.isArray(doc.player_ratings) && doc.player_ratings.length === 0) unset.player_ratings = '';
  if (doc.report !== undefined && (doc.report === '' || (typeof doc.report === 'string' && doc.report.trim() === '') || doc.report === null)) unset.report = '';

    // ensure player_of_the_match exists (schema still has single field)
    if (doc.player_of_the_match === undefined) updates.player_of_the_match = '';

    // build $set and $unset
    const setObj = {};
    for (const k of Object.keys(updates)) setObj[k] = updates[k];
    const unsetObj = {};
    for (const k of Object.keys(unset)) unsetObj[k] = unset[k];

    // if no changes, skip
    const willChange = Object.keys(setObj).length > 0 || Object.keys(unsetObj).length > 0;
    if (!willChange) {
      // still increment count for limit
      count++;
      continue;
    }

    console.log('Match', doc.match_id, 'will be updated. dry=', dry);
    if (dry) {
      console.log('  $set:', JSON.stringify(setObj, null, 2));
      if (Object.keys(unsetObj).length) console.log('  $unset:', JSON.stringify(unsetObj, null, 2));
    } else {
      try {
        await Match.updateOne({ _id: doc._id }, { $set: setObj, $unset: unsetObj });
        console.log('  Updated', doc.match_id);
      } catch (e) {
        console.error('  Failed to update', doc.match_id, e && (e.message || e));
      }
    }

    count++;
  }

  console.log('Done, processed', count);
  process.exit(0);
}

main().catch(e => { console.error('Script failed', e); process.exit(1); });
