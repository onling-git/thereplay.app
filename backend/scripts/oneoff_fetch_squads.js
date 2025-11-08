// oneoff_fetch_squads.js
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');
const { fetchMatchStats, fetchTeamSquad } = require('../controllers/matchSyncController');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');

async function main() {
  const matchId = Number(process.argv[2] || process.env.INSPECT_MATCH_ID);
  if (!matchId) {
    console.error('Usage: node oneoff_fetch_squads.js <matchId>');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.DBURI, { dbName: process.env.DBNAME || undefined });

  console.log('Fetching SportMonks fixture for', matchId);
  const sm = await fetchMatchStats(matchId);
  if (!sm) {
    console.error('No fixture data');
    process.exit(1);
  }

  // determine team ids
  const homeId = sm.home_team_id || sm.localteam_id || sm.home_id || sm.localteam?.id;
  const awayId = sm.away_team_id || sm.visitorteam_id || sm.away_id || sm.visitorteam?.id;

  const lineup = { home: [], away: [] };
  let foundAny = false;

  if (homeId) {
    try {
      const homeSquad = await fetchTeamSquad(homeId);
      if (homeSquad) {
        const players = Array.isArray(homeSquad) ? homeSquad : (homeSquad.players || homeSquad.data || []);
        for (const p of players) {
          lineup.home.push({ player_id: p.id ?? p.player_id ?? p.player?.id, name: p.fullname || p.name || p.player?.name || p.player_name || null, number: p.number ?? null, position: p.position ?? null });
        }
        console.log('Fetched home squad count', lineup.home.length);
        foundAny = true;
      } else console.log('No home squad found for', homeId);
    } catch (e) {
      console.warn('Home squad fetch failed:', e.message || e);
    }
  }

  if (awayId) {
    try {
      const awaySquad = await fetchTeamSquad(awayId);
      if (awaySquad) {
        const players = Array.isArray(awaySquad) ? awaySquad : (awaySquad.players || awaySquad.data || []);
        for (const p of players) {
          lineup.away.push({ player_id: p.id ?? p.player_id ?? p.player?.id, name: p.fullname || p.name || p.player?.name || p.player_name || null, number: p.number ?? null, position: p.position ?? null });
        }
        console.log('Fetched away squad count', lineup.away.length);
        foundAny = true;
      } else console.log('No away squad found for', awayId);
    } catch (e) {
      console.warn('Away squad fetch failed:', e.message || e);
    }
  }

  if (!foundAny) {
    console.log('No squads returned by provider for match', matchId);
    await mongoose.disconnect();
    process.exit(0);
  }

  // attach ratings from provider rates if available or DB
  const providerRatings = (sm.rates && sm.rates.data) ? sm.rates.data : [];
  const mapProvider = new Map();
  for (const r of providerRatings) {
    const name = r.player?.name || r.player_name || null;
    if (name) mapProvider.set(String(name).toLowerCase(), Number(r.rating));
  }

  const dbMatch = await Match.findOne({ match_id: matchId }).lean();
  const dbRatings = new Map(((dbMatch && dbMatch.player_ratings) || []).map(r => [String(r.player || '').toLowerCase(), r.rating]));

  const attachRatings = (arr) => arr.map(p => {
    const name = String(p.name || '').toLowerCase();
    const rating = mapProvider.get(name) ?? dbRatings.get(name) ?? null;
    return { ...p, rating };
  });

  const lineupToSave = { home: attachRatings(lineup.home || []), away: attachRatings(lineup.away || []) };

  const updated = await Match.findOneAndUpdate({ match_id: matchId }, { $set: { lineup: lineupToSave, player_stats: normaliseFixtureToMatchDoc(sm).player_stats || [] } }, { new: true });

  console.log('Persisted squads for match', matchId, 'home/away counts:', (updated.lineup.home||[]).length, (updated.lineup.away||[]).length);

  await mongoose.disconnect();
}

main().catch(e=>{ console.error(e); process.exit(1); });
