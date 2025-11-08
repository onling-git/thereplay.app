// scripts/backfill_inferred_ratings.js
// Usage: node backfill_inferred_ratings.js <matchId>
// Prefer loading the repo's backend/.env when running this script from workspace root
require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const Match = require('../models/Match');
const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');

async function main() {
  const matchId = process.argv[2] || process.env.INSPECT_MATCH_ID;
  if (!matchId) {
    console.error('Usage: node backfill_inferred_ratings.js <matchId>');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.DBURI, { dbName: process.env.DBNAME || undefined });

  // Fetch SportMonks fixture using controller helper (robust include permutations)
  let smMatch = null;
  let doc = null;
  try {
    const { fetchMatchStats } = require('../controllers/matchSyncController');
  // Request finished-match includes so SportMonks may return lineup.details with ratings
  smMatch = await fetchMatchStats(matchId, { forFinished: true });
  } catch (e) {
    console.warn('Failed to fetch SportMonks fixture via fetchMatchStats, proceeding with local data:', e.response?.status || e.message || e);
  }

  // If we got a SportMonks fixture, normalise it to our doc shape and upsert key fields
  if (smMatch) {
    const doc = normaliseFixtureToMatchDoc(smMatch);
    // update events/player_stats in DB so inference has richer input
    // Only write lineup if the normaliser actually produced a non-empty lineup to avoid
    // clobbering an existing one fetched earlier by other scripts.
    const setObj = {
      events: doc.events || [],
      player_stats: doc.player_stats || []
    };
    if (doc.lineup && ((doc.lineup.home && doc.lineup.home.length) || (doc.lineup.away && doc.lineup.away.length))) {
      setObj.lineup = doc.lineup;
    }
    await Match.findOneAndUpdate({ match_id: Number(matchId) }, { $set: setObj });
    console.log('Updated match with SportMonks lineup/player_stats');
  }

  const match = await Match.findOne({ match_id: Number(matchId) }).lean();
  if (!match) {
    console.error('Match not found:', matchId);
    process.exit(3);
  }

  // Collect provider ratings from multiple possible provider shapes.
  // 1) smMatch.rates.data (explicit rates endpoint)
  // 2) normalized flattened doc.lineups[].details[*].data.value (constructed by normaliseFixtureToMatchDoc)
  // 3) raw smMatch.lineups / smMatch.lineup groups -> players[].details
  const ratings = [];

  // Helper to push a rating record
  const pushRating = (playerName, playerId, value, teamId) => {
    if (playerName && value != null && !Number.isNaN(Number(value))) {
      ratings.push({
        player: playerName,
        player_id: playerId || null,
        rating: Number(value),
        team: teamId || null,
        inferred: false,
        source: 'sportmonks',
        calculated_at: new Date()
      });
    }
  };

  // 1) rates endpoint
  if (smMatch.rates?.data && Array.isArray(smMatch.rates.data) && smMatch.rates.data.length) {
    for (const r of smMatch.rates.data) {
      if (r.player && r.rating != null) pushRating(r.player.name, r.player.id || null, r.rating, r.team_id || null);
    }
  }

  // 2) normalized flattened lineups (doc.lineups) — prefer these when present
  if (!ratings.length && doc && Array.isArray(doc.lineups) && doc.lineups.length) {
    for (const p of doc.lineups) {
      // look for details entries with type_id 118 or any data.value present
      const details = Array.isArray(p.details) ? p.details : [];
      for (const d of details) {
        const typeId = d.type_id ?? d.type?.id ?? null;
        const val = d.data?.value ?? d.value ?? null;
        if ((typeId === 118 || val != null) && val != null) {
          pushRating(p.player_name || p.name || null, p.player_id || null, val, p.team_id || null);
          break; // one rating per player
        }
      }
    }
  }

  // 3) raw sportmonks lineup groups -> players[].details
  if (!ratings.length && smMatch) {
    const rawLineups = smMatch.lineups?.data || smMatch.lineups || smMatch.lineup?.data || smMatch.lineup || [];
    if (Array.isArray(rawLineups)) {
      for (const group of rawLineups) {
        // group may be a grouped object with `players[]`, or it may itself be a player entry
        let players = [];
        if (Array.isArray(group.players)) players = group.players;
        else if (Array.isArray(group.player)) players = group.player;
        else if (group && (group.player_id || group.player || group.id || group.player_name || group.name)) players = [group];
        for (const p of players) {
          const details = Array.isArray(p.details) ? p.details : (Array.isArray(p.player?.details) ? p.player.details : []);
          for (const d of details) {
            const typeId = d.type_id ?? d.type?.id ?? null;
            const val = d.data?.value ?? d.value ?? null;
            if ((typeId === 118 || val != null) && val != null) {
              const pname = p.player?.name || p.player_name || p.name || null;
              const pid = p.player_id ?? p.player?.id ?? p.id ?? null;
              const teamId = p.team_id ?? group.team_id ?? null;
              pushRating(pname, pid, val, teamId);
              break;
            }
          }
        }
      }
    }
  }

  if (!ratings.length) {
    console.log('No provider ratings found for match', matchId, '— tried rates, normalized lineups and raw lineup.details. Nothing to apply.');
    process.exit(0);
  }

  // write back only provider ratings
  const update = { player_ratings: ratings };
  await mongoose.model('Match').findOneAndUpdate({ match_id: Number(matchId) }, { $set: update });
  console.log('Provider ratings applied for match', matchId);
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
