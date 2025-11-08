// controllers/matchListController.js
const Match = require('../models/Match');

const toSlug = s =>
  String(s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

function parseDateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/:teamName/matches
 * Query params:
 *  - from (ISO), to (ISO)   -> date window filter
 *  - limit (int, default 20, max 100)
 *  - page  (int, default 1)
 *  - sort  (one of: "asc" | "desc" by date, default desc)
 */
exports.listLiveMatches = async (req, res) => {
  // heuristic: status_code like 'LIVE', '1H', '2H', 'ET', or time.minute != null
  const q = {
    $or: [
      { 'match_status.short_name': { $in: ['LIVE','1H','2H','ET'] } },
      { minute: { $ne: null } }
    ]
  };
  const rows = await Match.find(q).sort({ 'match_info.starting_at': -1 }).limit(200).lean();
  res.json(rows);
};

exports.listTeamLiveMatches = async (req, res) => {
  const teamSlug = req.params.teamName.toLowerCase();
  const q = {
    $and: [
      {
        $or: [{ home_team_slug: teamSlug }, { away_team_slug: teamSlug }]
      },
      {
        $or: [
          { 'match_status.short_name': { $in: ['LIVE','1H','2H','ET'] } },
          { minute: { $ne: null } }
        ]
      }
    ]
  };
  const rows = await Match.find(q).sort({ 'match_info.starting_at': -1 }).limit(5).lean();
  res.json(rows);
};

exports.listMatches = async (req, res) => {
  try {
    const teamSlug = toSlug(req.params.teamName);
    const from = parseDateOrNull(req.query.from);
    const to = parseDateOrNull(req.query.to);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '20', 10), 100));
    const page = Math.max(1, parseInt(req.query.page || '1', 10));
    const sortDir = (req.query.sort || 'desc').toLowerCase() === 'asc' ? 1 : -1;

    const filter = {
      $or: [{ home_team_slug: teamSlug }, { away_team_slug: teamSlug }],
    };
    if (from || to) {
      filter['match_info.starting_at'] = {};
      if (from) filter['match_info.starting_at'].$gte = from;
      if (to) filter['match_info.starting_at'].$lte = to;
    }

    const cursor = Match.find(filter)
      .sort({ 'match_info.starting_at': sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const [items, total] = await Promise.all([
      cursor,
      Match.countDocuments(filter),
    ]);

    res.json({
      page,
      limit,
      total,
      items,
    });
  } catch (err) {
    console.error('listMatches error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/:teamName/matches/recent
 * Returns the N most recent finished matches (date <= now)
 * Query: limit (default 5)
 */
exports.listRecent = async (req, res) => {
  try {
    const teamSlug = toSlug(req.params.teamName);
    const now = new Date();
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '5', 10), 50));

    const items = await Match.find({
      $or: [{ home_team_slug: teamSlug }, { away_team_slug: teamSlug }],
      date: { $lte: now },
    })
      .sort({ date: -1 })
      .limit(limit)
      .lean();

    res.json({ items });
  } catch (err) {
    console.error('listRecent error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

/**
 * GET /api/:teamName/matches/upcoming
 * Returns the N nearest upcoming matches (date > now)
 * Query: limit (default 3)
 */
exports.listUpcoming = async (req, res) => {
  try {
    const teamSlug = toSlug(req.params.teamName);
    const now = new Date();
    const limit = Math.max(1, Math.min(parseInt(req.query.limit || '3', 10), 50));

    const items = await Match.find({
      $or: [{ home_team_slug: teamSlug }, { away_team_slug: teamSlug }],
      date: { $gt: now },
    })
      .sort({ date: 1 })
      .limit(limit)
      .lean();

    if (!items.length) return res.status(404).json({ error: 'No upcoming matches' });
    res.json({ items });
  } catch (err) {
    console.error('listUpcoming error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};