// routes/adminCountryRoutes.js
const express = require('express');
const router = express.Router();
const Country = require('../models/Country');
const League = require('../models/League');
const adminAuth = require('../middleware/adminAuth');

// All admin country routes require admin authentication (API key or admin user)
router.use(adminAuth(true));

// Escape user input before using it in a RegExp
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// GET /api/admin/countries?enabled=true&search=eng
// List all countries with per-country league counts, sorted by name
router.get('/', async (req, res) => {
  try {
    const { enabled, search } = req.query;
    const filter = {};

    if (enabled === 'true' || enabled === 'false') {
      filter.enabled = enabled === 'true';
    }
    if (search && search.trim()) {
      const rx = new RegExp(escapeRegex(search.trim()), 'i');
      filter.$or = [{ name: rx }, { iso2: rx }, { iso3: rx }];
    }

    const countries = await Country.find(filter).sort({ name: 1 }).lean();

    // Attach league counts per country for the admin UI
    const leagueCounts = await League.aggregate([
      {
        $group: {
          _id: '$country_id',
          total: { $sum: 1 },
          enabled: { $sum: { $cond: ['$enabled', 1, 0] } }
        }
      }
    ]);
    const countMap = new Map(leagueCounts.map(c => [c._id, c]));

    res.json(countries.map(c => ({
      ...c,
      leagues_total: countMap.get(c.id)?.total || 0,
      leagues_enabled: countMap.get(c.id)?.enabled || 0
    })));
  } catch (err) {
    console.error('[admin countries] list error:', err);
    res.status(500).json({ error: 'Failed to load countries' });
  }
});

// PATCH /api/admin/countries/:countryId
// Update country settings (enabled)
router.patch('/:countryId', async (req, res) => {
  try {
    const countryId = Number(req.params.countryId);
    if (isNaN(countryId)) {
      return res.status(400).json({ error: 'Invalid country ID' });
    }

    const updates = {};
    if (typeof req.body?.enabled === 'boolean') updates.enabled = req.body.enabled;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nothing to update — provide enabled' });
    }

    const country = await Country.findOneAndUpdate(
      { id: countryId },
      { $set: updates },
      { new: true }
    );

    if (!country) {
      return res.status(404).json({ error: 'Country not found' });
    }
    res.json(country);
  } catch (err) {
    console.error('[admin countries] update error:', err);
    res.status(500).json({ error: 'Failed to update country' });
  }
});

module.exports = router;
