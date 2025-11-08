#!/usr/bin/env node
// One-off script to dedupe comments for match_id 19431868
// Usage: node dedupe_comments_match_19431868.js [--apply]

const { connectDB, closeDB } = require('../db/connect');
const Match = require('../models/Match');
const { mergeComments } = require('../utils/comments');

async function run() {
  const apply = process.argv.includes('--apply');
  const uri = process.env.MONGO_URI || process.env.DBURI || process.env.MONGO_URL;
  if (!uri) {
    console.error('Missing MongoDB URI. Set MONGO_URI or DBURI in environment.');
    process.exit(2);
  }

  await connectDB(uri, { dbName: process.env.DBNAME || undefined });

  try {
    const matchId = 19431868;
    const match = await Match.findOne({ match_id: matchId }).lean();
    if (!match) {
      console.error('Match not found:', matchId);
      return;
    }

    const existing = Array.isArray(match.comments) ? match.comments : [];
    const deduped = mergeComments([], existing); // we only care about incoming dedupe on stored comments

    console.log('match_id', matchId, 'existing comments:', existing.length, 'deduped:', deduped.length);
    if (existing.length === deduped.length) {
      console.log('No change required.');
    } else {
      console.log('Sample differences:');
      console.log('--- existing (first 5) ---');
      console.log(JSON.stringify(existing.slice(0,5), null, 2));
      console.log('--- deduped (first 5) ---');
      console.log(JSON.stringify(deduped.slice(0,5), null, 2));
      if (apply) {
        const res = await Match.findOneAndUpdate({ match_id: matchId }, { $set: { comments: deduped } }, { new: true });
        console.log('Applied dedupe. New comments length:', Array.isArray(res.comments) ? res.comments.length : 0);
      } else {
        console.log('Dry-run (no DB changes). Re-run with --apply to persist.');
      }
    }
  } catch (e) {
    console.error('Script failed:', e?.message || e);
  } finally {
    await closeDB();
  }
}

run();
