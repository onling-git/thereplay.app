// scripts/fixTeamMatchIds.js
require('dotenv').config();
const mongoose = require('mongoose');

const Team = require('../models/Team');
const Match = require('../models/Match');

const DBURI = process.env.DBURI;
if (!DBURI) {
  console.error('Please set DBURI in .env');
  process.exit(1);
}

async function safeNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toSlug(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

(async () => {
  try {
    await mongoose.connect(DBURI, { maxPoolSize: 10 });
    console.log('[seed] connected to DB');

    const teams = await Team.find({}).lean();
    console.log(`[seed] found ${teams.length} teams`);

    let fixed = 0;
    let skipped = 0;
    let failed = 0;

    for (const t of teams) {
      const updates = {};
      try {
        // last_match_info
        if (t.last_match_info) {
          const lm = t.last_match_info;
          const num = await safeNum(lm.match_id);
          if (num == null) {
            // try match_oid
            if (lm.match_oid) {
              const m = await Match.findById(lm.match_oid).lean();
              if (m && m.match_id) {
                updates['last_match_info.match_id'] = Number(m.match_id);
              }
            } else if (lm.date && lm.opponent_name) {
              // best-effort: find a match on the same date with opponent
              const start = new Date(lm.date); start.setUTCDate(start.getUTCDate() - 1);
              const end = new Date(lm.date); end.setUTCDate(end.getUTCDate() + 1);
              const candidate = await Match.findOne({
                date: { $gte: start, $lte: end },
                $or: [{ home_team: t.name, away_team: lm.opponent_name }, { home_team: lm.opponent_name, away_team: t.name }]
              }).lean();
              if (candidate && candidate.match_id) updates['last_match_info.match_id'] = Number(candidate.match_id);
            }
          }
        }

        // next_match_info
        if (t.next_match_info) {
          const nm = t.next_match_info;
          const numn = await safeNum(nm.match_id);
          if (numn == null) {
            if (nm.match_oid) {
              const m2 = await Match.findById(nm.match_oid).lean();
              if (m2 && m2.match_id) updates['next_match_info.match_id'] = Number(m2.match_id);
            } else if (nm.date && nm.opponent_name) {
              const start = new Date(nm.date); start.setUTCDate(start.getUTCDate() - 1);
              const end = new Date(nm.date); end.setUTCDate(end.getUTCDate() + 1);
              const candidate2 = await Match.findOne({
                date: { $gte: start, $lte: end },
                $or: [{ home_team: t.name, away_team: nm.opponent_name }, { home_team: nm.opponent_name, away_team: t.name }]
              }).lean();
              if (candidate2 && candidate2.match_id) updates['next_match_info.match_id'] = Number(candidate2.match_id);
            }
          }
        }

        if (Object.keys(updates).length) {
          await Team.updateOne({ _id: t._id }, { $set: updates });
          fixed++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`[fix] team ${t.slug || t.name} failed`, err?.message || err);
        failed++;
      }
    }

    console.log(`[fix] done. fixed=${fixed} skipped=${skipped} failed=${failed}`);
    process.exit(0);
  } catch (err) {
    console.error('Fatal error', err);
    process.exit(1);
  }
})();
