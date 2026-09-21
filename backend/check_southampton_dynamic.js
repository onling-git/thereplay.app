// One-off: call getTeamMatchesFromDb directly for southampton to see resolved lastFinished/nextUpcoming/liveMatch
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

for (const rel of ['.env.production', '.env.local', '.env']) {
  const p = path.resolve(__dirname, rel);
  if (fs.existsSync(p)) { dotenv.config({ path: p }); console.log(`[check] loaded env from ${rel}`); break; }
}

const mongoose = require('mongoose');
const { getTeamMatchesFromDb, getDynamicTeamMatchInfo } = require('./utils/teamMatchUtils');

async function main() {
  const uri = process.env.DBURI || process.env.MONGODB_URI;
  await mongoose.connect(uri);
  console.log('[check] Connected');

  const { lastFinished, nextUpcoming, liveMatch } = await getTeamMatchesFromDb('southampton', 'Southampton');
  console.log('[check] liveMatch:', liveMatch ? `${liveMatch.match_id} state=${liveMatch.match_status?.state} starting_at=${liveMatch.match_info?.starting_at}` : null);
  console.log('[check] nextUpcoming:', nextUpcoming ? `${nextUpcoming.match_id} state=${nextUpcoming.match_status?.state} starting_at=${nextUpcoming.match_info?.starting_at}` : null);
  console.log('[check] lastFinished:', lastFinished ? `${lastFinished.match_id} state=${lastFinished.match_status?.state} starting_at=${lastFinished.match_info?.starting_at}` : null);

  const dyn = await getDynamicTeamMatchInfo('southampton', 'Southampton');
  console.log('[check] dynamicMatchInfo.last_match_info:', JSON.stringify(dyn.last_match_info));
  console.log('[check] dynamicMatchInfo.next_match_info:', JSON.stringify(dyn.next_match_info));

  await mongoose.disconnect();
  process.exit(0);
}

main().catch(e => { console.error('[check] fatal:', e); process.exit(1); });
