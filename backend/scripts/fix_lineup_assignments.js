// scripts/fix_lineup_assignments.js
// Usage: node fix_lineup_assignments.js <matchId>
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');

async function main() {
  const matchId = Number(process.argv[2] || process.env.INSPECT_MATCH_ID);
  if (!matchId) {
    console.error('Usage: node fix_lineup_assignments.js <matchId>');
    process.exit(2);
  }

  await mongoose.connect(process.env.MONGO_URI || process.env.DBURI, { dbName: process.env.DBNAME || undefined });

  const match = await Match.findOne({ match_id: matchId }).lean();
  if (!match) {
    console.error('Match not found', matchId);
    process.exit(3);
  }

  const homeId = match.home_team_id != null ? String(match.home_team_id) : null;
  const awayId = match.away_team_id != null ? String(match.away_team_id) : null;

  // Try to re-fetch the SportMonks fixture and rebuild lineups from the raw payload (more reliable)
  let sm = null;
  try {
    const { fetchMatchStats } = require('../controllers/matchSyncController');
    sm = await fetchMatchStats(matchId);
  } catch (e) {
    console.warn('Failed to fetch SportMonks fixture, falling back to existing DB entries:', e.message || e);
  }

  let finalHome = [];
  let finalAway = [];

  if (sm) {
    const raw = sm.lineups?.data || sm.lineups || sm.lineup?.data || sm.lineup || [];
    const homeIds = [match.home_team_id, match.localteam_id, match.home_team?.id].filter(Boolean).map(String);
    const awayIds = [match.away_team_id, match.visitorteam_id, match.away_team?.id].filter(Boolean).map(String);

    // Normalize raw into simple entries
    const entries = Array.isArray(raw) ? raw : (raw.players || []);
    for (const p of entries) {
      const teamId = p.team_id ?? p.team?.id ?? null;
      const item = {
        player_id: p.player_id ?? p.player?.id ?? p.id,
        team_id: teamId ?? null,
        name: p.player_name || (p.player && (p.player.name || p.player.fullname)) || p.name || null,
        number: p.jersey_number ?? p.number ?? null,
        position: p.position_id ?? p.position ?? p.role ?? null
      };
      const tId = teamId != null ? String(teamId) : null;
      if (tId && homeIds.includes(tId)) finalHome.push(item);
      else if (tId && awayIds.includes(tId)) finalAway.push(item);
      else {
        // if ambiguous, balance into smaller bucket
        if (finalHome.length <= finalAway.length) finalHome.push(item); else finalAway.push(item);
      }
    }

    await Match.findOneAndUpdate({ match_id: matchId }, { $set: { 'lineup.home': finalHome, 'lineup.away': finalAway } });
    console.log('Rebuilt lineup from SportMonks raw payload for', matchId, 'counts:', finalHome.length, finalAway.length);
  } else {
    console.log('Could not fetch SportMonks data; no changes made for', matchId);
  }
  await mongoose.disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
