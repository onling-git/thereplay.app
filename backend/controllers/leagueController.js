const Match = require('../models/Match');

/** GET /api/leagues
 * Returns a list of distinct leagues known to the DB as { id, name }
 * Falls back to an empty array if none found.
 */
exports.listLeagues = async (req, res) => {
  try {
    // Aggregate distinct league ids/names from Match documents
    const rows = await Match.aggregate([
      { $match: { 'match_info.league.id': { $exists: true } } },
      { $group: { _id: '$match_info.league.id', name: { $first: '$match_info.league.name' } } },
      { $project: { id: '$_id', name: 1, _id: 0 } },
      { $sort: { name: 1 } }
    ]).allowDiskUse(true);

    res.json(Array.isArray(rows) ? rows : []);
  } catch (e) {
    console.warn('[leagues] list failed', e?.message || e);
    res.status(500).json({ error: 'Failed to list leagues', detail: e?.message || e });
  }
};

/** GET /api/leagues/:leagueId/fixtures
 * Returns fixtures for a specific league, optionally filtered by date
 */
exports.getLeagueFixtures = async (req, res) => {
  try {
    const { leagueId } = req.params;
    const { date } = req.query;

    let matchFilter = {
      'match_info.league.id': parseInt(leagueId)
    };

    // If date is provided, filter by that date
    if (date) {
      const targetDate = new Date(date);
      const nextDay = new Date(targetDate);
      nextDay.setDate(nextDay.getDate() + 1);
      
      matchFilter['match_info.starting_at'] = {
        $gte: targetDate,
        $lt: nextDay
      };
    } else {
      // Default to today's matches
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      matchFilter['match_info.starting_at'] = {
        $gte: today,
        $lt: tomorrow
      };
    }

    const fixtures = await Match.find(matchFilter)
      .select({
        match_id: 1,
        teams: 1,
        score: 1,
        match_status: 1,
        match_info: 1,
        minute: 1
      })
      .sort({ 'match_info.starting_at': 1 })
      .limit(50)
      .lean();

    res.json(fixtures || []);
  } catch (e) {
    console.warn('[leagues] getLeagueFixtures failed', e?.message || e);
    res.status(500).json({ error: 'Failed to get league fixtures', detail: e?.message || e });
  }
};
