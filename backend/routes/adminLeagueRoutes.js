// routes/adminLeagueRoutes.js
const express = require('express');
const router = express.Router();
const League = require('../models/League');
const Country = require('../models/Country');
const adminAuth = require('../middleware/adminAuth');

// All admin league routes require admin authentication (API key or admin user)
router.use(adminAuth(true));

// Escape user input before using it in a RegExp
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/admin/leagues?enabled=true&country_id=462&search=premier
// List all leagues, optionally filtered by status, country, or name/code search
router.get('/', async (req, res) => {
  try {
    const { enabled, country_id, search } = req.query;
    const filter = {};

    if (enabled === 'true' || enabled === 'false') {
      filter.enabled = enabled === 'true';
    }
    if (country_id !== undefined && country_id !== '' && !isNaN(Number(country_id))) {
      filter.country_id = Number(country_id);
    }
    if (search && search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ name: rx }, { short_code: rx }];
    }

    const leagues = await League.find(filter)
      .populate({ path: 'country', select: 'id name iso2' })
      .sort({ priority: -1, name: 1 });

    res.json(leagues);
  } catch (err) {
    console.error('[admin leagues] list error:', err);
    res.status(500).json({ error: 'Failed to load leagues' });
  }
});

// GET /api/admin/leagues/stats
// League & country counts for the stats dashboard.
// NOTE: must be registered before /:leagueId so "stats" isn't treated as an ID.
router.get('/stats', async (req, res) => {
  try {
    const [leaguesTotal, leaguesEnabled, countriesTotal, countriesEnabled] = await Promise.all([
      League.countDocuments({}),
      League.countDocuments({ enabled: true }),
      Country.countDocuments({}),
      Country.countDocuments({ enabled: true })
    ]);

    res.json({
      leagues: { total: leaguesTotal, enabled: leaguesEnabled },
      countries: { total: countriesTotal, enabled: countriesEnabled }
    });
  } catch (err) {
    console.error('[admin leagues] stats error:', err);
    res.status(500).json({ error: 'Failed to load league stats' });
  }
});

// POST /api/admin/leagues/bulk-update
// Body: { league_ids: [8, 9], enabled: true } and/or { priority: 50 }
router.post('/bulk-update', async (req, res) => {
  try {
    const { league_ids, enabled, priority } = req.body || {};

    if (!Array.isArray(league_ids) || league_ids.length === 0) {
      return res.status(400).json({ error: 'league_ids must be a non-empty array' });
    }

    const ids = league_ids.map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) {
      return res.status(400).json({ error: 'league_ids must contain valid numeric IDs' });
    }

    const updates = {};
    if (typeof enabled === 'boolean') updates.enabled = enabled;
    if (priority !== undefined && !isNaN(Number(priority))) {
      updates.priority = Math.max(0, Math.min(100, Number(priority)));
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update — provide enabled and/or priority' });
    }

    const result = await League.updateMany({ id: { $in: ids } }, { $set: updates });

    res.json({
      message: `Updated ${result.modifiedCount} league(s)`,
      matched: result.matchedCount,
      updated: result.modifiedCount
    });
  } catch (err) {
    console.error('[admin leagues] bulk-update error:', err);
    res.status(500).json({ error: 'Failed to bulk update leagues' });
  }
});

// GET /api/admin/leagues/:leagueId - Get a single league
router.get('/:leagueId', async (req, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    if (isNaN(leagueId)) {
      return res.status(400).json({ error: 'Invalid league ID' });
    }

    const league = await League.findOne({ id: leagueId })
      .populate({ path: 'country', select: 'id name iso2' });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }
    res.json(league);
  } catch (err) {
    console.error('[admin leagues] get error:', err);
    res.status(500).json({ error: 'Failed to load league' });
  }
});

// PATCH /api/admin/leagues/:leagueId
// Update league settings (enabled and/or priority)
router.patch('/:leagueId', async (req, res) => {
  try {
    const leagueId = Number(req.params.leagueId);
    if (isNaN(leagueId)) {
      return res.status(400).json({ error: 'Invalid league ID' });
    }

    const updates = {};
    if (typeof req.body?.enabled === 'boolean') updates.enabled = req.body.enabled;
    if (req.body?.priority !== undefined) {
      const p = Number(req.body.priority);
      if (isNaN(p)) {
        return res.status(400).json({ error: 'priority must be a number' });
      }
      updates.priority = Math.max(0, Math.min(100, p));
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update — provide enabled and/or priority' });
    }

    const league = await League.findOneAndUpdate(
      { id: leagueId },
      { $set: updates },
      { new: true }
    ).populate({ path: 'country', select: 'id name iso2' });

    if (!league) {
      return res.status(404).json({ error: 'League not found' });
    }
    res.json(league);
  } catch (err) {
    console.error('[admin leagues] update error:', err);
    res.status(500).json({ error: 'Failed to update league' });
  }
});

module.exports = router;
