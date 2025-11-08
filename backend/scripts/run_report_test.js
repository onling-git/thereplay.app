#!/usr/bin/env node
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const { generateBothReports } = require('../controllers/reportController');

async function main() {
  const matchId = process.argv[2] || '19431868';
  console.log('Using matchId=', matchId);
  console.log('Connecting to DB...');
  try {
    await mongoose.connect(process.env.DBURI, { useNewUrlParser: true, useUnifiedTopology: true });
  } catch (e) {
    console.error('DB connect failed:', e?.message || e);
    process.exit(1);
  }

  try {
    const results = await generateBothReports(Number(matchId));
    console.log('generateBothReports returned count:', (results || []).length);
    for (const r of (results || [])) {
      console.log('REPORT SUMMARY:', {
        _id: r._id,
        match_id: r.match_id,
        team_slug: r.team_slug,
        headline: r.headline,
        status: r.status,
        finalized_at: r.finalized_at
      });
    }
    // fetch persisted reports to inspect saved potm/comments
    try {
      const Report = require('../models/Report');
      const persisted = await Report.find({ match_id: Number(matchId) }).lean();
      console.log('PERSISTED REPORTS:', JSON.stringify(persisted.map(p => ({ team_slug: p.team_slug, potm: p.potm })), null, 2));
    } catch (e) {
      console.warn('Failed to fetch persisted reports for inspection:', e?.message || e);
    }
    try {
      const Match = require('../models/Match');
      const matchDoc = await Match.findOne({ match_id: Number(matchId) }).lean();
      console.log('MATCH.player_ratings:', JSON.stringify(matchDoc.player_ratings || [], null, 2));
      console.log('MATCH.lineups (sample):', JSON.stringify((matchDoc.lineups || []).slice(0,40), null, 2));
    } catch (e) {
      console.warn('Failed to fetch match doc for inspection:', e?.message || e);
    }
  } catch (err) {
    console.error('Error generating reports:', err?.message || err);
  } finally {
    try { await mongoose.disconnect(); } catch (e) {}
  }
}

main().catch(e => { console.error('fatal:', e); process.exit(1); });
