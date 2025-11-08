// scripts/backfill_teams.js
// Backfill `teams` nested object from existing top-level fields
// Usage: node scripts/backfill_teams.js [matchId]

require('dotenv').config();
const connectDB = require('../db/connect');
const Match = require('../models/Match');

async function main() {
  const matchArg = process.argv[2];
  const filter = {};
  if (matchArg) {
    filter.match_id = Number(matchArg);
  } else {
    // target matches where teams.home.team_id is null/undefined or teams.home.team_name is empty
    filter['$or'] = [
      { 'teams.home.team_id': { $in: [null, undefined] } },
      { 'teams.away.team_id': { $in: [null, undefined] } },
      { 'teams.home.team_name': '' },
      { 'teams.away.team_name': '' },
      { teams: { $exists: false } }
    ];
  }

  try {
    await connectDB(process.env.DBURI || 'mongodb://localhost:27017/test');
    console.log('DB connected — running teams backfill', filter);

    const cursor = Match.find(filter).cursor();
    let updated = 0;
    for await (const m of cursor) {
      const set = {};
      set['teams.home'] = set['teams.home'] || {};
      set['teams.away'] = set['teams.away'] || {};

      set['teams.home'].team_name = m.home_team || (m.teams && m.teams.home && m.teams.home.team_name) || '';
      set['teams.home'].team_id = m.home_team_id ?? (m.teams && m.teams.home && m.teams.home.team_id) ?? null;
      set['teams.home'].team_slug = m.home_team_slug || (m.teams && m.teams.home && m.teams.home.team_slug) || '';

      set['teams.away'].team_name = m.away_team || (m.teams && m.teams.away && m.teams.away.team_name) || '';
      set['teams.away'].team_id = m.away_team_id ?? (m.teams && m.teams.away && m.teams.away.team_id) ?? null;
      set['teams.away'].team_slug = m.away_team_slug || (m.teams && m.teams.away && m.teams.away.team_slug) || '';

      await Match.findOneAndUpdate({ match_id: m.match_id }, { $set: set });
      console.log('patched match', m.match_id, '->', set);
      updated += 1;
    }

    console.log('Backfill completed. Documents updated:', updated);
    process.exit(0);
  } catch (e) {
    console.error('Backfill failed:', e);
    process.exit(1);
  }
}

main();
