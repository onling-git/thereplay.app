// scripts/fix_potm_from_provider.js
// Compute team-specific POTM from Match.player_ratings (provider data) and persist into Report.man_of_the_match and Match.potm
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Report = require('../models/Report');

function normalizeName(n) {
  if (!n) return null;
  return String(n).replace(/\u00A0/g, ' ').trim();
}

async function fix(matchId) {
  const MONGO = process.env.DBURI || process.env.MONGO_URI || 'mongodb://localhost:27017/fulltime';
  console.log('Connecting to', MONGO);
  await mongoose.connect(MONGO);
  try {
    const match = await Match.findOne({ match_id: Number(matchId) }).lean();
    if (!match) {
      console.error('Match not found');
      return;
    }

    const reports = await Report.find({ match_id: match.match_id }).lean();
    if (!reports || !reports.length) {
      console.log('No reports for match', matchId);
      return;
    }

    // Build name map from match.lineups
    const lineup = Array.isArray(match.lineups) ? match.lineups : [];
    const byId = new Map();
    for (const p of lineup) {
      if (p.player_id) byId.set(String(p.player_id), normalizeName(p.player_name || p.player || p.name || null));
    }

    const updates = {};
    for (const rpt of reports) {
      const teamId = rpt.team_id || null;
      let teamRatings = Array.isArray(match.player_ratings) ? match.player_ratings.filter(r => r.team_id && String(r.team_id) === String(teamId)) : [];
      // if no numeric ratings, still pick from players of that team
      const numeric = teamRatings.filter(r => typeof r.rating === 'number');
      let chosen = null;
      if (numeric.length) {
        chosen = numeric.sort((a,b) => (b.rating||0) - (a.rating||0))[0];
      } else if (teamRatings.length) {
        chosen = teamRatings[0];
      } else {
        // no ratings matched by team_id; try to infer from lineup membership by matching player_ids
        teamRatings = Array.isArray(match.player_ratings) ? match.player_ratings.filter(r => r.player_id && byId.has(String(r.player_id))) : [];
        if (teamRatings.length) {
          const nums = teamRatings.filter(r => typeof r.rating === 'number');
          chosen = nums.length ? nums.sort((a,b) => (b.rating||0) - (a.rating||0))[0] : teamRatings[0];
        }
      }

      let motm = { player: null, rating: null, reason: null };
      if (chosen) {
        let playerName = chosen.player || (chosen.player_id ? byId.get(String(chosen.player_id)) : null) || null;
        playerName = normalizeName(playerName);
        motm.player = playerName || (chosen.player_id ? String(chosen.player_id) : null);
        motm.rating = (typeof chosen.rating === 'number') ? chosen.rating : null;
        motm.reason = motm.rating ? `Highest rating (${motm.rating})` : 'Selected from provider lineup';
      }

      // Update report
      await Report.findOneAndUpdate({ _id: rpt._id }, { $set: { 'man_of_the_match.player': motm.player, 'man_of_the_match.reason': motm.reason } });

      // Prepare Match.potm update
      if (rpt.team_slug) {
        if (!updates['potm']) updates['potm'] = {};
        // decide home/away key by slug match against match home/away slugs/names
        const homeSlug = String(match.home_team_slug || '').toLowerCase();
        const awaySlug = String(match.away_team_slug || '').toLowerCase();
        const key = (homeSlug && String(rpt.team_slug).toLowerCase() === homeSlug) ? 'home' : ((awaySlug && String(rpt.team_slug).toLowerCase() === awaySlug) ? 'away' : null);
        if (key) updates['potm.' + key] = { player: motm.player, rating: motm.rating, reason: motm.reason, source: 'provider' };
      }
    }

    if (Object.keys(updates).length) {
      await Match.findOneAndUpdate({ match_id: match.match_id }, { $set: updates });
      console.log('Updated Match.potm for match', matchId);
    }
    console.log('Updated reports for match', matchId);
  } catch (e) {
    console.error('fix_potm error:', e?.message || e);
  } finally {
    await mongoose.disconnect();
  }
}

const args = process.argv.slice(2);
if (!args.length) {
  console.log('Usage: node fix_potm_from_provider.js <matchId>');
  process.exit(1);
}

fix(args[0]).catch(e => { console.error(e); process.exit(1); });
