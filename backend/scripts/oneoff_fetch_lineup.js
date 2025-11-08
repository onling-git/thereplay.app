// oneoff_fetch_lineup.js
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');
const { fetchMatchStats } = require('../controllers/matchSyncController');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');

async function main() {
  const matchId = Number(process.argv[2] || process.env.INSPECT_MATCH_ID);
  if (!matchId) {
    console.error('Usage: node oneoff_fetch_lineup.js <matchId>');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.DBURI, { dbName: process.env.DBNAME || undefined });

  console.log('Fetching SportMonks fixture for', matchId);
  const sm = await fetchMatchStats(matchId);
  if (!sm) {
    console.error('No fixture data');
    process.exit(1);
  }

  const norm = normaliseFixtureToMatchDoc(sm) || {};
  let lineup = (norm && norm.lineup) ? norm.lineup : { home: [], away: [] };

  // If normalization didn't yield a lineup, try to use the raw SportMonks payload
  if ((!(lineup.home && lineup.home.length) && !(lineup.away && lineup.away.length)) && sm) {
    const { partitionRawLineups } = require('../utils/lineup');
    const parts = partitionRawLineups(sm, { home_team_id: sm.home_team_id, away_team_id: sm.away_team_id, localteam_id: sm.localteam_id, visitorteam_id: sm.visitorteam_id, home_team: sm.home_team, away_team: sm.away_team });
    lineup = parts;
    console.log('Using partitioned raw SportMonks lineups, counts:', (lineup.home||[]).length, (lineup.away||[]).length);
  }

  const providerRatings = (sm.rates && sm.rates.data) ? sm.rates.data : [];
  const mapProvider = new Map();
  for (const r of providerRatings) {
    const name = r.player?.name || r.player_name || null;
    if (name) mapProvider.set(String(name).toLowerCase(), Number(r.rating));
  }

  const dbMatch = await Match.findOne({ match_id: matchId }).lean();
  const dbRatings = new Map(((dbMatch && dbMatch.player_ratings) || []).map(r => [String(r.player || '').toLowerCase(), r.rating]));

  const attachRatings = (arr) => (arr || []).map(p => {
    const name = String(p.name || '').toLowerCase();
    const rating = mapProvider.get(name) ?? dbRatings.get(name) ?? null;
    return { ...p, rating };
  });

  const lineupToSave = { home: attachRatings(lineup.home || []), away: attachRatings(lineup.away || []) };

  const update = { lineup: lineupToSave, player_stats: norm.player_stats || [] };
  const updated = await Match.findOneAndUpdate({ match_id: matchId }, { $set: update }, { new: true });

  console.log('Updated match lineup for', matchId, 'lineup counts:', (updated.lineup.home||[]).length, (updated.lineup.away||[]).length);

  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
