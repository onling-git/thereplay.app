// controllers/matchController.js
const Match = require('../models/Match');
const Report = require('../models/Report');
const Team = require('../models/Team');

const slug = s => String(s || '').trim().toLowerCase();

async function resolveTeamNameOrThrow(teamSlug) {
  const team = await Team.findOne({ slug: slug(teamSlug) }).lean();
  if (!team) {
    const err = new Error(`Team not found for slug: ${teamSlug}`);
    err.statusCode = 404;
    throw err;
  }
  return team.name; // e.g. "West Ham United"
}

/**
 * GET /api/:teamName/last-match
 * Returns most recent finished (date <= now), otherwise nearest upcoming.
 */
exports.getLastMatchByTeam = async (req, res) => {
  try {
    const teamSlug = req.params.teamName;
    const fullName = await resolveTeamNameOrThrow(teamSlug);
    const now = new Date();

    // Most recent finished. Support both legacy top-level home_team/away_team
    // and the newer nested teams.home.team_name / teams.away.team_name
    const lastFinished = await Match.findOne({
      $or: [
        { 'teams.home.team_name': fullName },
        { 'teams.away.team_name': fullName }
      ],
      'match_info.starting_at': { $lte: now }
    })
      .sort({ 'match_info.starting_at': -1 })
      .lean();

    if (lastFinished) return res.json(lastFinished);

    // Nearest upcoming
    const upcoming = await Match.findOne({
      $or: [
        { 'teams.home.team_name': fullName },
        { 'teams.away.team_name': fullName }
      ],
      'match_info.starting_at': { $gt: now }
    })
      .sort({ 'match_info.starting_at': 1 })
      .lean();

    if (upcoming) return res.json(upcoming);

    return res.status(404).json({ error: 'No matches found for this team.' });
  } catch (err) {
    console.error('getLastMatchByTeam error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Server error' });
  }
};

/**
 * GET /api/:teamName/match/:matchId
 * Returns full match if team participated.
 */
exports.getMatchByTeamAndId = async (req, res) => {
  try {
    const teamSlug = req.params.teamName;
    const fullName = await resolveTeamNameOrThrow(teamSlug);
    const matchId = Number(req.params.matchId);

    const match = await Match.findOne({
      match_id: matchId,
      $or: [
        { 'teams.home.team_name': fullName },
        { 'teams.away.team_name': fullName }
      ]
    }).lean();

    if (!match) return res.status(404).json({ error: 'Match not found' });
    res.json(match);
  } catch (err) {
    console.error('getMatchByTeamAndId error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Server error' });
  }
};

/**
 * GET /api/:teamName/match/:matchId/report
 * Returns only the report field (404 if not present).
 */
exports.getMatchReport = async (req, res) => {
  try {
    const teamSlug = req.params.teamName;
    const fullName = await resolveTeamNameOrThrow(teamSlug);
    const matchId = Number(req.params.matchId);

    // fetch match data with team info and basic details
    const match = await Match.findOne(
      {
        match_id: matchId,
        $or: [
          { 'teams.home.team_name': fullName },
          { 'teams.away.team_name': fullName }
        ]
      },
      { 
        'reports.home': 1, 
        'reports.away': 1, 
        'teams.home.team_name': 1, 
        'teams.away.team_name': 1, 
        'score.home': 1,
        'score.away': 1,
        match_id: 1,
        date: 1,
        status: 1,
        match_status: 1
      }
    ).lean();

    if (!match) return res.status(404).json({ error: 'Match not found' });
    // determine which side the request is for (home or away)
    const isHome = (match.teams && match.teams.home && match.teams.home.team_name === fullName) || false;
    const isAway = (match.teams && match.teams.away && match.teams.away.team_name === fullName) || false;
    let reportId = null;
    if (isHome) reportId = match.reports && match.reports.home;
    else if (isAway) reportId = match.reports && match.reports.away;
    else return res.status(400).json({ error: 'Team not part of this match' });

    if (!reportId) return res.status(404).json({ error: 'Report not available yet' });

    // Prepare match details for response
    const matchDetails = {
      match_id: match.match_id,
      home_team: match.teams?.home?.team_name,
      away_team: match.teams?.away?.team_name,
      home_score: match.score?.home,
      away_score: match.score?.away,
      date: match.date,
      status: match.match_status?.short_name || match.match_status?.state || match.status
    };

    // If it's stored as legacy string, return it directly
    if (typeof reportId === 'string') {
      if (reportId.trim() === '') return res.status(404).json({ error: 'Report not available yet' });
      return res.json({ 
        ...matchDetails,
        report: reportId
      });
    }

    try {
      const reportDoc = await Report.findById(reportId).lean();
      if (!reportDoc) return res.status(404).json({ error: 'Report not found' });
      return res.json({ 
        ...matchDetails,
        report: reportDoc
      });
    } catch (e) {
      console.warn('getMatchReport: failed to load Report doc', e?.message || e);
      return res.status(500).json({ error: 'Failed to load report' });
    }
  } catch (err) {
    console.error('getMatchReport error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Server error' });
  }
};

/**
 * (Optional) GET /api/:teamName/upcoming
 */
exports.getUpcomingMatch = async (req, res) => {
  try {
    const teamSlug = req.params.teamName;
    const fullName = await resolveTeamNameOrThrow(teamSlug);
    const now = new Date();

    const upcoming = await Match.findOne({
      $or: [
        { 'teams.home.team_name': fullName },
        { 'teams.away.team_name': fullName }
      ],
      'match_info.starting_at': { $gt: now }
    })
      .sort({ 'match_info.starting_at': 1 })
      .lean();

    if (!upcoming) return res.status(404).json({ error: 'No upcoming match' });
    res.json(upcoming);
  } catch (err) {
    console.error('getUpcomingMatch error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Server error' });
  }
};

exports.setMatchReport = async (req, res) => {
  try {
    const teamSlug = req.params.teamName;
    const fullName = await resolveTeamNameOrThrow(teamSlug);
    const matchId = Number(req.params.matchId);
    const { report } = req.body;

    if (!report || !String(report).trim()) {
      return res.status(400).json({ error: 'Report text is required' });
    }

    // create a Report doc for manual report text and attach to match
    const reportDoc = await Report.create({
      match_id: matchId,
      team_focus: fullName,
      headline: String(report).slice(0, 200),
      summary_paragraphs: [String(report)],
      key_moments: [],
      player_ratings: [],
      man_of_the_match: { player: null, reason: null },
      evidence_ref: {},
      meta: { generated_by: 'manual' }
    });

    // update match: set appropriate reports.home/away slot and metadata
    const match = await Match.findOne({ match_id: matchId, $or: [ { 'teams.home.team_name': fullName }, { 'teams.away.team_name': fullName } ]}).lean();
    if (!match) return res.status(404).json({ error: 'Match not found' });

    const set = { 'reports.generated_at': new Date(), 'reports.model': 'manual' };
    if (match.home_team === fullName || (match.teams && match.teams.home && match.teams.home.team_name === fullName)) set['reports.home'] = reportDoc._id;
    else if (match.away_team === fullName || (match.teams && match.teams.away && match.teams.away.team_name === fullName)) set['reports.away'] = reportDoc._id;

    await Match.findOneAndUpdate({ match_id: matchId }, { $set: set });
    res.json({ ok: true, match_id: matchId, report_id: reportDoc._id });
  } catch (err) {
    console.error('setMatchReport error:', err);
    res.status(err.statusCode || 500).json({ error: err.message || 'Server error' });
  }
};

/**
 * GET /api/matches/live
 * Returns live and upcoming matches, prioritizing top leagues
 */
exports.getLiveMatches = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    const now = new Date();
    
    // Define top league priorities
    const topLeagueIds = [39, 140, 78, 135, 61]; // EPL, La Liga, Bundesliga, Serie A, Ligue 1
    
    // Get live matches first (currently in progress)
    const liveMatches = await Match.find({
      $or: [
        { 'match_status.short_name': { $in: ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP'] } },
        { status: { $in: ['LIVE', 'IN_PLAY', 'HALF_TIME', 'EXTRA_TIME'] } }
      ]
    })
    .select({
      match_id: 1,
      teams: 1,
      score: 1,
      match_status: 1,
      match_info: 1,
      minute: 1,
      status: 1
    })
    .lean();

    // Get upcoming matches for today, prioritizing top leagues
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const upcomingMatches = await Match.find({
      'match_info.starting_at': { $gte: now, $lt: tomorrow },
      $or: [
        { 'match_status.short_name': { $in: ['NS', 'TBD'] } },
        { status: { $in: ['SCHEDULED', 'NOT_STARTED'] } }
      ]
    })
    .select({
      match_id: 1,
      teams: 1,
      score: 1,
      match_status: 1,
      match_info: 1,
      minute: 1,
      status: 1
    })
    .sort({ 'match_info.starting_at': 1 })
    .lean();

    // Combine and prioritize
    let allMatches = [...liveMatches, ...upcomingMatches];
    
    // Sort by priority: live matches first, then by league priority, then by time
    allMatches.sort((a, b) => {
      const aIsLive = a.match_status?.short_name && ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP'].includes(a.match_status.short_name);
      const bIsLive = b.match_status?.short_name && ['1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP'].includes(b.match_status.short_name);
      
      if (aIsLive && !bIsLive) return -1;
      if (!aIsLive && bIsLive) return 1;
      
      // Both live or both upcoming - sort by league priority
      const aLeagueId = a.match_info?.league?.id;
      const bLeagueId = b.match_info?.league?.id;
      const aPriority = topLeagueIds.indexOf(aLeagueId);
      const bPriority = topLeagueIds.indexOf(bLeagueId);
      
      if (aPriority !== -1 && bPriority === -1) return -1;
      if (aPriority === -1 && bPriority !== -1) return 1;
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      
      // Same priority - sort by time
      const aTime = new Date(a.match_info?.starting_at || 0);
      const bTime = new Date(b.match_info?.starting_at || 0);
      return aTime - bTime;
    });

    res.json(allMatches.slice(0, limit));
  } catch (err) {
    console.error('getLiveMatches error:', err);
    res.status(500).json({ error: 'Failed to get live matches' });
  }
};

/**
 * GET /api/matches/today
 * Returns all matches for a specific date (default today)
 */
exports.getTodayMatches = async (req, res) => {
  try {
    const { date } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);
    
    let targetDate;
    if (date) {
      targetDate = new Date(date);
    } else {
      targetDate = new Date();
    }
    
    targetDate.setHours(0, 0, 0, 0);
    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);
    
    const matches = await Match.find({
      'match_info.starting_at': {
        $gte: targetDate,
        $lt: nextDay
      }
    })
    .select({
      match_id: 1,
      teams: 1,
      score: 1,
      match_status: 1,
      match_info: 1,
      minute: 1,
      status: 1
    })
    .sort({ 'match_info.starting_at': 1 })
    .limit(limit)
    .lean();

    res.json(matches || []);
  } catch (err) {
    console.error('getTodayMatches error:', err);
    res.status(500).json({ error: 'Failed to get today matches' });
  }
};
