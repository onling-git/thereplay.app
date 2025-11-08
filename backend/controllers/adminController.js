// controllers/adminController.js
const Match = require('../models/Match');

const slugify = s =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

/**
 * POST /api/admin/backfill/match-slugs
 * Populates home_team_slug / away_team_slug for existing rows.
 */
async function backfillMatchSlugs(req, res) {
  try {
    const cursor = Match.find({
      $or: [{ home_team_slug: { $exists: false } }, { away_team_slug: { $exists: false } }]
    }).cursor();

    let updated = 0;
    for (let doc = await cursor.next(); doc != null; doc = await cursor.next()) {
      const $set = {};
      if (doc.home_team && !doc.home_team_slug) $set.home_team_slug = slugify(doc.home_team);
      if (doc.away_team && !doc.away_team_slug) $set.away_team_slug = slugify(doc.away_team);
      if (Object.keys($set).length) {
        await Match.updateOne({ _id: doc._id }, { $set });
        updated++;
      }
    }

    res.json({ ok: true, updated });
  } catch (e) {
    console.error('backfillMatchSlugs error:', e);
    res.status(500).json({ error: 'Backfill failed' });
  }
}

/**
 * (Optional) POST /api/admin/seed/future-match
 * Body: { home_team, away_team, kickoffISO }
 */
async function seedFutureMatch(req, res) {
  try {
    const { home_team, away_team, kickoffISO } = req.body;
    if (!home_team || !away_team || !kickoffISO) {
      return res.status(400).json({ error: 'home_team, away_team, kickoffISO are required' });
    }
    const date = new Date(kickoffISO);
    if (isNaN(date.getTime())) return res.status(400).json({ error: 'Invalid kickoffISO' });

    const doc = await Match.create({
      match_id: Date.now(), // simple unique id for testing
      date,
      home_team,
      away_team,
      // let model pre-save hook set slugs; or set here:
      // home_team_slug: slugify(home_team),
      // away_team_slug: slugify(away_team),
      score: { home: 0, away: 0 },
      events: [],
      player_ratings: [],
      player_of_the_match: '',
      match_status: { id: null, state: '', name: '', short_name: '', developer_name: '' },
      report: ''
    });

    res.json({ ok: true, match_id: doc.match_id });
  } catch (e) {
    console.error('seedFutureMatch error:', e);
    res.status(500).json({ error: 'Seed failed' });
  }
}

module.exports = {
  backfillMatchSlugs,
  seedFutureMatch,
};
