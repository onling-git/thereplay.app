// update_team_matches.js
// Recompute last_match_info and next_match_info for a given team id and update the Team doc.

const { connectDB, closeDB } = require('../db/connect');
const Match = require('../models/Match');
const Team = require('../models/Team');

async function computeSnapshotForMatchForTeam(match, teamId) {
  if (!match) return null;
  const isHome = String(match.teams?.home?.team_id) === String(teamId) || String(match.home_team_id) === String(teamId);
  const opponent = isHome ? (match.teams?.away?.team_name || match.away_team) : (match.teams?.home?.team_name || match.home_team);
  const goals_for = isHome ? (match.score?.home ?? 0) : (match.score?.away ?? 0);
  const goals_against = isHome ? (match.score?.away ?? 0) : (match.score?.home ?? 0);
  const win = goals_for > goals_against ? true : (goals_for === goals_against ? null : false);
  return {
    opponent_name: opponent || '',
    goals_for,
    goals_against,
    win,
    date: match.match_info?.starting_at || match.date || null,
    match_id: Number(match.match_id),
    match_oid: match._id,
    home_game: Boolean(isHome),
  };
}

async function updateTeamMatches(teamId) {
  const teamIdNum = Number(teamId);
  if (!Number.isFinite(teamIdNum)) throw new Error('teamId must be numeric');
  // latest finished match
  // Match finished detection: accept various provider values (finished, ft, fulltime, etc.)
  const finishedRegex = /finished|fulltime|ft/i;
  const latestFinished = await Match.findOne({
    $and: [
      {
        $or: [
          { 'teams.home.team_id': teamIdNum },
          { 'teams.away.team_id': teamIdNum }
        ]
      },
      {
        $or: [
          { 'match_status.state': { $regex: finishedRegex } },
          { 'match_status.name': { $regex: finishedRegex } },
          { 'match_status.short_name': { $regex: finishedRegex } },
          { status: { $regex: finishedRegex } }
        ]
      }
    ]
  }).sort({ date: -1 }).lean();

  let lastSnapshot = null;
  let lastPlayedAt = null;
  if (latestFinished) {
    lastSnapshot = await computeSnapshotForMatchForTeam(latestFinished, teamId);
    lastPlayedAt = lastSnapshot.date;
  }

  // next upcoming match (not finished) after now
  const now = new Date();
  // For next match, exclude finished-like statuses using regex
  const nextMatch = await Match.findOne({
    $or: [
      { 'teams.home.team_id': teamIdNum },
      { 'teams.away.team_id': teamIdNum }
    ],
    $and: [
      { date: { $gt: now } },
      {
        $nor: [
          { 'match_status.state': { $regex: finishedRegex } },
          { 'match_status.name': { $regex: finishedRegex } },
          { 'match_status.short_name': { $regex: finishedRegex } },
          { status: { $regex: finishedRegex } }
        ]
      }
    ]
  }).sort({ date: 1 }).lean();

  let nextSnapshot = null;
  let nextGameAt = null;
  if (nextMatch) {
    console.log('[update_team_matches] nextMatch candidate:', nextMatch.match_id, nextMatch.teams?.home, nextMatch.teams?.away);
    nextSnapshot = {
      opponent_name: (String(nextMatch.teams?.home?.team_id) === String(teamId)) ? (nextMatch.teams?.away?.team_name || nextMatch.away_team) : (nextMatch.teams?.home?.team_name || nextMatch.home_team),
      date: nextMatch.match_info?.starting_at || nextMatch.date,
      match_id: Number(nextMatch.match_id),
      match_oid: nextMatch._id,
      home_game: String(nextMatch.teams?.home?.team_id) === String(teamId),
    };
    nextGameAt = nextSnapshot.date;
  }

  const update = {
    last_match_info: lastSnapshot,
    last_played_at: lastPlayedAt || null,
    next_match_info: nextSnapshot,
    next_game_at: nextGameAt || null,
  };

  const res = await Team.findOneAndUpdate({ id: Number(teamIdNum) }, { $set: update }, { new: true }).lean();
  return res;
}

async function main() {
  const teamId = process.argv[2] || process.env.TEAM_ID || 65;
  const mongoUrl = process.env.DBURI || process.env.MONGO_URI || process.env.MONGOURL;
  if (!mongoUrl) {
    console.error('Set DBURI or MONGO_URI env var to run');
    process.exit(2);
  }

  await connectDB(mongoUrl);
  try {
    console.log('[update_team_matches] updating team', teamId);
    const updated = await updateTeamMatches(teamId);
    console.log('[update_team_matches] updated team doc:', updated);
  } catch (e) {
    console.error('[update_team_matches] error', e?.message || e);
  } finally {
    await closeDB();
  }
}

if (require.main === module) main();
