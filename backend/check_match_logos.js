require('dotenv').config({ path: '.env.production', override: true });
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function main() {
  await mongoose.connect(process.env.DBURI);
  const m = await Match.findOne({ match_id: 19722154 }).lean();
  console.log('home logo:', m.teams?.home?.logo);
  console.log('away logo:', m.teams?.away?.logo);
  const sept = new Date('2026-09-01');
  const withLogos = await Match.countDocuments({ 'teams.home.logo': { $type: 'string', $ne: '' }, date: { $gte: sept } });
  const total = await Match.countDocuments({ date: { $gte: sept } });
  console.log(`Sept matches with home logo: ${withLogos} / ${total}`);
  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
