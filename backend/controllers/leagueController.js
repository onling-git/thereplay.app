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
