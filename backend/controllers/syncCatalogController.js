const Team = require('../models/Team');
const { paginate } = require('../utils/sportmonksPaginate');

const slugify = (s) => String(s||'').trim().toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');

/**
 * POST /api/sync/catalog/teams
 * Body (optional):
 *   {
 *     include: "..."          // sportmonks include param for teams
 *     pageStart: 1,           // start page
 *     maxPages: 999,          // limit pages if you want to test
 *     delayMs: 150,           // delay between pages
 *     filters: { country_id: 462 } // optional: if Sportmonks supports filters via query params on /teams
 *   }
 */
exports.syncAllTeams = async (req, res) => {
  try {
    const {
      include,
      pageStart = 1,
      maxPages = Infinity,
      delayMs = 150,
      filters = {}
    } = req.body || {};

    // Upsert counter
    let upserts = 0;
    let total = 0;

    await paginate('/teams', { include, ...filters }, async (t) => {
      total += 1;
      const idNum = Number(t?.id);
      const name = String(t?.name || '').trim();
      if (!name || !Number.isFinite(idNum)) return;

      const slug = slugify(name);
      const update = {
        name,
        slug,
        id: idNum,
        country_id: t.country_id ?? undefined,
        gender: t.gender ?? 'male',
        image_path: t.image_path ?? undefined,
        short_code: t.short_code ?? undefined,
        founded: t.founded ?? undefined,
        type: t.type ?? 'domestic',
        updatedAt: new Date()
      };

      // Upsert by numeric provider id to avoid duplicate-key errors on slug uniqueness
      await Team.findOneAndUpdate(
        { id: idNum },
        { $set: update, $setOnInsert: { createdAt: new Date() } },
        { upsert: true, new: true }
      );
      upserts += 1;
    }, { pageStart, maxPages, delayMs });

    res.json({ ok: true, total_seen: total, upserts });
  } catch (e) {
    console.error('syncAllTeams error:', e?.response?.data || e);
    res.status(500).json({ error: 'Teams catalog sync failed', detail: e.message });
  }
};
