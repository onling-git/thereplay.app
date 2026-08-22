// utils/teamMatchUtils.js
const Match = require('../models/Match');

const toSlug = s => String(s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

/**
 * Dynamically find the last finished and next upcoming match for a team
 * This always returns current data based on the current date/time
 */
async function getTeamMatchesFromDb(teamSlug, teamName) {
  const now = new Date();
  const slug = toSlug(teamSlug);

  // Build query to find matches for this team (using both slug and name for compatibility)
  const teamQueries = [
    { 'teams.home.team_slug': slug },
    { 'teams.away.team_slug': slug },
    { home_team_slug: slug },
    { away_team_slug: slug },
  ];

  // Add team name queries if available
  if (teamName) {
    teamQueries.push(
      { 'teams.home.team_name': teamName },
      { 'teams.away.team_name': teamName },
      { home_team: teamName },
      { away_team: teamName }
    );
  }

  const teamMatchQuery = { $or: teamQueries };

  // Check for any live matches first.
  // Exclude matches that kicked off more than 3 hours ago: if a doc is still in a
  // "live" state long after kickoff it's stale (the provider/webhook never flipped
  // it to FT), not actually in progress. Without this cutoff, a stuck "live" doc
  // from a previous season would be returned as the team's current match forever.
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  const liveMatch = await Match.findOne({
    $and: [
      teamMatchQuery,
      {
        'match_status.state': { $in: ['live', '1H', '2H', 'HT', 'INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_HALF_TIME', 'LIVE'] }
      },
      { 'match_info.starting_at': { $gte: threeHoursAgo } }
    ]
  })
  .sort({ 
    'match_info.starting_at': -1,
    date: -1
  })
  .lean();

  // If there is an upcoming match, use its season as the boundary for the
  // last-finished lookup so we do not show a previous-season match when a new
  // season has started.
  const upcomingSeasonId = liveMatch?.match_info?.season?.id ?? null;

  // Find next upcoming match
  // If there's a live match, that takes priority as "next"
  // Otherwise, find the earliest future match.
  // NOTE: query on match_info.starting_at only. Mongo's $gt with a Date value
  // only matches Date-typed fields, so docs with missing/string starting_at are
  // excluded — important because BSON sort orders null/missing/string BEFORE
  // Date, so such docs would sort first in an ascending sort and poison the result.
  let nextUpcoming;
  if (liveMatch) {
    nextUpcoming = liveMatch;
  } else {
    nextUpcoming = await Match.findOne({
      $and: [
        teamMatchQuery,
        { 'match_info.starting_at': { $gt: now } }
      ]
    })
    .sort({ 'match_info.starting_at': 1 })
    .lean();

    // Legacy fallback: docs that only have the top-level `date` field
    if (!nextUpcoming) {
      nextUpcoming = await Match.findOne({
        $and: [
          teamMatchQuery,
          { $or: [
              { 'match_info.starting_at': { $exists: false } },
              { 'match_info.starting_at': null }
          ]},
          { date: { $gt: now } }
        ]
      })
      .sort({ date: 1 })
      .lean();
    }
  }

  const seasonFilter = upcomingSeasonId
    ? {
        $or: [
          { 'match_info.season.id': upcomingSeasonId },
          { 'season.id': upcomingSeasonId }
        ]
      }
    : null;

  // Find last finished match (most recent past match, excluding live matches)
  let lastFinished = null;

  const lastFinishedQuery = {
    $and: [
      teamMatchQuery,
      // Same reasoning as above: $lte with a Date only matches Date-typed values
      { 'match_info.starting_at': { $lte: now } },
      // Only consider truly finished matches
      { 'match_status.state': { $in: ['finished', 'FT'] } }
    ]
  };

  if (seasonFilter) {
    const seasonScopedQuery = {
      $and: [
        ...lastFinishedQuery.$and,
        seasonFilter
      ]
    };

    lastFinished = await Match.findOne(seasonScopedQuery)
      .sort({
        'match_info.starting_at': -1,
        date: -1
      })
      .lean();
  }

  if (!lastFinished) {
    lastFinished = await Match.findOne(lastFinishedQuery)
      .sort({ 
        'match_info.starting_at': -1,
        date: -1
      })
      .lean();
  }

  // Legacy fallback: docs that only have the top-level `date` field
  if (!lastFinished) {
    lastFinished = await Match.findOne({
      $and: [
        teamMatchQuery,
        { $or: [
            { 'match_info.starting_at': { $exists: false } },
            { 'match_info.starting_at': null }
        ]},
        { date: { $lte: now } },
        { 'match_status.state': { $in: ['finished', 'FT'] } }
      ]
    })
    .sort({ date: -1 })
    .lean();
  }

  return { lastFinished, nextUpcoming, liveMatch };
}

/**
 * Create a last_match_info snapshot from a match document
 */
function createLastMatchSnapshot(match, teamSlug) {
  if (!match) return null;

  const slug = toSlug(teamSlug);
  
  // Determine if team was home or away
  const isHome = (
    toSlug(match.teams?.home?.team_slug || match.home_team_slug || match.home_team || '') === slug ||
    toSlug(match.teams?.home?.team_name || match.home_team || '') === slug
  );

  const opponent = isHome 
    ? (match.teams?.away?.team_name || match.away_team || '')
    : (match.teams?.home?.team_name || match.home_team || '');

  const goalsFor = isHome 
    ? (match.score?.home ?? 0)
    : (match.score?.away ?? 0);

  const goalsAgainst = isHome 
    ? (match.score?.away ?? 0) 
    : (match.score?.home ?? 0);

  const win = goalsFor > goalsAgainst ? true : (goalsFor === goalsAgainst ? null : false);
  
  const matchDate = match.match_info?.starting_at || match.date;

  return {
    opponent_name: opponent,
    goals_for: goalsFor,
    goals_against: goalsAgainst,
    win: win,
    date: matchDate,
    match_id: match.match_id,
    match_oid: match._id,
    home_game: isHome
  };
}

/**
 * Create a next_match_info snapshot from a match document
 */
function createNextMatchSnapshot(match, teamSlug) {
  if (!match) return null;

  const slug = toSlug(teamSlug);
  
  // Determine if team will be home or away
  const isHome = (
    toSlug(match.teams?.home?.team_slug || match.home_team_slug || match.home_team || '') === slug ||
    toSlug(match.teams?.home?.team_name || match.home_team || '') === slug
  );

  const opponent = isHome 
    ? (match.teams?.away?.team_name || match.away_team || '')
    : (match.teams?.home?.team_name || match.home_team || '');

  const matchDate = match.match_info?.starting_at || match.date;

  // Check if this is a live match
  const isLive = match.match_status?.state && ['live', '1H', '2H', 'HT', 'INPLAY_1ST_HALF', 'INPLAY_2ND_HALF', 'INPLAY_HALF_TIME', 'LIVE'].includes(match.match_status.state);

  const result = {
    opponent_name: opponent,
    date: matchDate,
    match_id: match.match_id,
    match_oid: match._id,
    home_game: isHome
  };

  // Add live match specific data
  if (isLive) {
    result.status = match.match_status;
    result.score = match.score;
    result.match_info = match.match_info;
    result.is_live = true;
  }

  return result;
}

/**
 * Get dynamic team match info that's always current
 * This replaces the need to rely on potentially stale last_match_info/next_match_info
 */
async function getDynamicTeamMatchInfo(teamSlug, teamName = null) {
  try {
    const { lastFinished, nextUpcoming } = await getTeamMatchesFromDb(teamSlug, teamName);
    
    return {
      last_match_info: createLastMatchSnapshot(lastFinished, teamSlug),
      next_match_info: createNextMatchSnapshot(nextUpcoming, teamSlug),
      last_played_at: lastFinished?.match_info?.starting_at || lastFinished?.date || null,
      next_game_at: nextUpcoming?.match_info?.starting_at || nextUpcoming?.date || null
    };
  } catch (error) {
    console.error('getDynamicTeamMatchInfo error:', error);
    throw error;
  }
}

/**
 * Get team with match references resolved
 * This is the new preferred method using the reference-based approach
 */
async function getTeamWithMatchReferences(teamSlug) {
  const Team = require('../models/Team');

  try {
    const team = await Team.findOne({ slug: teamSlug }).lean();

    if (!team) return null;

    // Manually resolve match references using match_id
    let lastMatch = null;
    let nextMatch = null;

    if (team.last_match) {
      lastMatch = await Match.findOne({ match_id: team.last_match }).lean();
    }

    if (team.next_match) {
      nextMatch = await Match.findOne({ match_id: team.next_match }).lean();
    }

    // Transform matches to the expected format
    const result = {
      ...team,
      last_match_info: lastMatch ? createLastMatchSnapshot(lastMatch, teamSlug) : null,
      next_match_info: nextMatch ? createNextMatchSnapshot(nextMatch, teamSlug) : null
    };

    return result;
  } catch (error) {
    console.error('getTeamWithMatchReferences error:', error);
    throw error;
  }
}

/**
 * Format match data for backwards compatibility with existing frontend code
 * This takes a populated match document and formats it like the old embedded data
 */
function formatMatchForCompatibility(match, teamSlug, isNext = false) {
  if (!match) return null;

  const snapshot = isNext 
    ? createNextMatchSnapshot(match, teamSlug)
    : createLastMatchSnapshot(match, teamSlug);

  return snapshot;
}

module.exports = {
  getTeamMatchesFromDb,
  createLastMatchSnapshot,
  createNextMatchSnapshot,
  getDynamicTeamMatchInfo,
  getTeamWithMatchReferences,
  formatMatchForCompatibility
};