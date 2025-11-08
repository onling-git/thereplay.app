// scripts/sync_reports_for_match.js
// Upsert skeleton reports for a match and copy provider arrays from Match -> Report
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Match = require('../models/Match');
const Report = require('../models/Report');

function readDbUri() {
  const envPath = path.join(__dirname, '..', '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  const m = content.match(/^DBURI\s*=\s*(.*)$/m);
  if (m) return String(m[1]).replace(/^['"]|['"]$/g, '').trim();
  const m2 = content.match(/^MONGO_URI\s*=\s*(.*)$/m);
  if (m2) return String(m2[1]).replace(/^['"]|['"]$/g, '').trim();
  throw new Error('DBURI not found in .env');
}

async function syncMatch(matchId) {
  const uri = readDbUri();
  console.log('Connecting to', uri);
  await mongoose.connect(uri);
  const match = await Match.findOne({ match_id: Number(matchId) }).lean();
  if (!match) {
    console.log('Match not found');
    await mongoose.disconnect();
    return;
  }

  const homeSlug = match.home_team_slug || (match.teams && match.teams.home && match.teams.home.team_slug) || (match.home_team ? String(match.home_team).toLowerCase().replace(/[^a-z0-9]+/g,'-') : `__home_${matchId}`);
  const awaySlug = match.away_team_slug || (match.teams && match.teams.away && match.teams.away.team_slug) || (match.away_team ? String(match.away_team).toLowerCase().replace(/[^a-z0-9]+/g,'-') : `__away_${matchId}`);

  const homeTeamId = match.home_team_id ?? match.teams?.home?.team_id ?? null;
  const awayTeamId = match.away_team_id ?? match.teams?.away?.team_id ?? null;

  // Upsert home report
  const now = new Date();
  // ratingsToUse will contain provider ratings either from match.player_ratings or built from match.lineups
  let ratingsToUse = Array.isArray(match.player_ratings) ? match.player_ratings.slice() : [];
  // If match.lineups exists, build a complete provider-shaped player_ratings array (include players even with null ratings)
  try {
    if (Array.isArray(match.lineups) && match.lineups.length) {
      // build a map of player_id -> player_name
      const nameMap = new Map();
      for (const p of match.lineups) {
        if (p.player_id) nameMap.set(String(p.player_id), p.player_name || p.player || null);
      }
      const extracted = match.lineups.map(p => {
        const pid = p.player_id || null;
        // prefer explicit rating on the lineup entry
        let ratingVal = null;
        if (p.rating !== undefined && p.rating !== null) ratingVal = Number(p.rating);
        // otherwise try details (older provider shape)
        if ((ratingVal === null || ratingVal === undefined) && Array.isArray(p.details) && p.details.length) {
          const det = p.details.find(d => d.type_id === 118) || p.details[0];
          if (det && det.data && (det.data.value !== undefined && det.data.value !== null)) ratingVal = Number(det.data.value);
        }
        return {
          player: nameMap.get(String(pid)) || p.player_name || p.player || (pid ? String(pid) : null),
          player_id: pid,
          team_id: p.team_id || null,
          rating: ratingVal !== undefined ? (ratingVal === null ? null : Number(ratingVal)) : null,
          lineup_id: p.id || p.lineup_id || null,
          source: 'sportmonks:lineup',
          calculated_at: new Date().toISOString()
        };
      });
      // Always prefer the canonical lineup-extracted array as the authoritative provider ratings
      ratingsToUse = extracted;
      try {
        await Match.findOneAndUpdate({ match_id: match.match_id }, { $set: { player_ratings: extracted } });
        console.log('Persisted extracted player_ratings to Match (all lineup players)');
      } catch (e) {
        console.warn('Failed to persist extracted player_ratings to Match:', e?.message || e);
      }
    }
  } catch (e) {
    console.warn('Error extracting ratings in sync script:', e?.message || e);
  }
  const homeUpsert = {
    $setOnInsert: {
      match_id: match.match_id,
      team_id: homeTeamId,
      team_focus: match.home_team || (match.teams && match.teams.home && match.teams.home.team_name) || null,
      team_slug: homeSlug,
      status: 'draft'
    },
    $set: {
      last_synced_at: now,
      source_counts: {
        events: (match.events || []).length,
        comments: (match.comments || []).length
      },
      events: match.events || [],
      comments: match.comments || []
    }
  };

  const awayUpsert = {
    $setOnInsert: {
      match_id: match.match_id,
      team_id: awayTeamId,
      team_focus: match.away_team || (match.teams && match.teams.away && match.teams.away.team_name) || null,
      team_slug: awaySlug,
      status: 'draft'
    },
    $set: {
      last_synced_at: now,
      source_counts: {
        events: (match.events || []).length,
        comments: (match.comments || []).length
      },
      events: match.events || [],
      comments: match.comments || []
    }
  };

  try {
    await Report.findOneAndUpdate({ match_id: match.match_id, team_slug: homeSlug }, homeUpsert, { upsert: true, new: true });
    await Report.findOneAndUpdate({ match_id: match.match_id, team_slug: awaySlug }, awayUpsert, { upsert: true, new: true });
    console.log('Synced reports for match', matchId);
  } catch (e) {
    console.error('Failed to sync reports:', e?.message || e);
  }

  await mongoose.disconnect();
}

const args = process.argv.slice(2);
if (!args.length) {
  console.log('Usage: node sync_reports_for_match.js <matchId>');
  process.exit(1);
}

syncMatch(args[0]).catch(e => { console.error(e); process.exit(1); });
