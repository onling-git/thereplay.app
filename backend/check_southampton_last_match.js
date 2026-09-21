// One-off diagnostic: inspect Southampton's most recent matches to see why
// last_match_info isn't updating on the team overview page.
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

for (const rel of ['.env.production', '.env.local', '.env']) {
  const p = path.resolve(__dirname, rel);
  if (fs.existsSync(p)) { dotenv.config({ path: p }); console.log(`[check] loaded env from ${rel}`); break; }
}

const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');

async function main() {
  const uri = process.env.DBURI || process.env.MONGODB_URI;
  if (!uri) { console.error('DBURI not set'); process.exit(1); }
  await mongoose.connect(uri);
  console.log('[check] Connected');

  const team = await Team.findOne({ slug: 'southampton' }).lean();
  console.log('[check] Team doc last_match/next_match:', team?.last_match, team?.next_match);
  console.log('[check] Team doc last_match_info:', JSON.stringify(team?.last_match_info));

  const now = new Date();
  const matches = await Match.find({
    $and: [
      { $or: [
        { 'teams.home.team_slug': 'southampton' },
        { 'teams.away.team_slug': 'southampton' }
      ]},
      { 'match_info.starting_at': { $lte: now } }
    ]
  })
  .sort({ 'match_info.starting_at': -1 })
  .limit(8)
  .select('match_id match_info.starting_at match_status.state teams.home.team_name teams.away.team_name')
  .lean();

  console.log('[check] Most recent 8 PAST matches (by starting_at, now=' + now.toISOString() + '):');
  for (const m of matches) {
    console.log(`  match_id=${m.match_id} starting_at=${m.match_info?.starting_at} state="${m.match_status?.state}" ${m.teams?.home?.team_name} vs ${m.teams?.away?.team_name}`);
  }

  const target = await Match.findOne({ match_id: 19729087 }).select('match_id match_info.starting_at match_status.state teams.home.team_name teams.away.team_name').lean();
  console.log('[check] team.next_match (19729087) doc:', JSON.stringify(target));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('[check] fatal:', e); process.exit(1); });
