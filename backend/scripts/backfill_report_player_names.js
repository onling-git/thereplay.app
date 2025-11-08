// scripts/backfill_report_player_names.js
// Backfill missing player names in Report.player_ratings and Match.player_ratings using Match.lineups
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Report = require('../models/Report');

function normalizeName(n) { if (!n) return null; return String(n).replace(/\u00A0/g,' ').trim(); }

async function backfill(matchId) {
  const MONGO = process.env.DBURI || process.env.MONGO_URI || 'mongodb://localhost:27017/fulltime';
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO);
  try {
    const match = await Match.findOne({ match_id: Number(matchId) }).lean();
    if (!match) return console.error('Match not found');

    const lineup = Array.isArray(match.lineups) ? match.lineups : [];
    const byId = new Map();
    const byName = new Map();
    for (const p of lineup) {
      const id = p.player_id ? String(p.player_id) : null;
      const name = normalizeName(p.player_name || p.player || p.name || null);
      if (id) byId.set(id, name);
      if (name) byName.set(String(name).toLowerCase(), name);
    }

    // Backfill Match.player_ratings
    const mr = Array.isArray(match.player_ratings) ? match.player_ratings.map(r => ({...r})) : [];
    let changedMatch = false;
    for (const r of mr) {
      if ((!r.player || String(r.player).trim() === '') && r.player_id) {
        const name = byId.get(String(r.player_id));
        if (name) { r.player = name; changedMatch = true; }
      }
      if ((!r.player || String(r.player).trim() === '') && r.player_name) {
        r.player = normalizeName(r.player_name);
        changedMatch = true;
      }
    }
    if (changedMatch) {
      await Match.findOneAndUpdate({ match_id: match.match_id }, { $set: { player_ratings: mr } });
      console.log('Backfilled Match.player_ratings');
    }

    // Backfill Reports
    const reports = await Report.find({ match_id: match.match_id });
    for (const rpt of reports) {
      let changed = false;
      // ensure report.lineups mirror match.lineups when available
      if ((!Array.isArray(rpt.lineups) || !rpt.lineups.length) && lineup.length) {
        rpt.lineups = lineup;
        changed = true;
      }
      const pr = Array.isArray(rpt.player_ratings) ? rpt.player_ratings : [];
      for (let i=0;i<pr.length;i++) {
        const r = pr[i];
        if ((!r.player || String(r.player).trim() === '') && r.player_id) {
          const name = byId.get(String(r.player_id));
          if (name) { pr[i].player = name; changed = true; }
        }
      }
      if (changed) {
        rpt.player_ratings = pr;
        await rpt.save();
        console.log('Updated report', String(rpt._id));
      }
    }
    console.log('Backfill complete for match', matchId);
  } catch (e) {
    console.error('Backfill error:', e?.message || e);
  } finally {
    await mongoose.disconnect();
  }
}

const args = process.argv.slice(2);
if (!args.length) { console.log('Usage: node backfill_report_player_names.js <matchId>'); process.exit(1); }
backfill(args[0]).catch(e => { console.error(e); process.exit(1); });
