// scripts/dedupe_reports.js
// Usage: node scripts/dedupe_reports.js [--fix]

const mongoose = require('mongoose');
const Report = require('../models/Report');
const Match = require('../models/Match');

const MONGO = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';

async function main() {
  const fix = process.argv.includes('--fix');
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });

  // Group by match_id and team_slug (or team_focus if slug missing)
  const pipeline = [
    {
      $project: {
        match_id: 1,
        team_slug: { $ifNull: ["$team_slug", "$team_focus"] },
        createdAt: 1
      }
    },
    {
      $group: {
        _id: { match_id: '$match_id', key: '$team_slug' },
        count: { $sum: 1 },
        docs: { $push: { _id: '$_id', createdAt: '$createdAt' } }
      }
    },
    { $match: { count: { $gt: 1 } } }
  ];

  const dupes = await Report.aggregate(pipeline).allowDiskUse(true);
  console.log('Found', dupes.length, 'duplicate groups');

  for (const d of dupes) {
    const docs = d.docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // newest first
    const keep = docs[0];
    const remove = docs.slice(1);
    console.log(`match ${d._id.match_id} key=${d._id.key} -> keep ${keep._id} remove ${remove.map(r=>r._id).join(',')}`);
    if (fix) {
      // remove duplicates
      const idsToRemove = remove.map(r => r._id);
      await Report.deleteMany({ _id: { $in: idsToRemove } });
      // ensure Match.reports points to kept id where appropriate
      try {
        const matchDoc = await Match.findOne({ match_id: d._id.match_id });
        if (matchDoc) {
          const ks = String(d._id.key || '').toLowerCase();
          const homeSlug = String(matchDoc.home_team_slug || '').toLowerCase();
          const awaySlug = String(matchDoc.away_team_slug || '').toLowerCase();
          const set = {};
          if (ks && ks === homeSlug) set['reports.home'] = keep._id;
          else if (ks && ks === awaySlug) set['reports.away'] = keep._id;
          // if key matches neither, don't touch
          if (Object.keys(set).length) {
            await Match.updateOne({ match_id: d._id.match_id }, { $set: set });
            console.log('Updated Match.reports for', d._id.match_id);
          }
        }
      } catch (e) { console.warn('Failed to update match pointer', e.message || e); }
    }
  }

  console.log('Done');
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
