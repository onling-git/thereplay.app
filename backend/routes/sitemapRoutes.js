const express = require('express');
const Team = require('../models/Team');
const Match = require('../models/Match');
const Report = require('../models/Report');
const NewsCollectionSnapshot = require('../models/NewsCollectionSnapshot');
const { publicReportStages } = require('../utils/publicReports');
const { TYPES, entriesFor, sitemapIndex, sitemapXml } = require('../utils/sitemap');

const router = express.Router();
const sendXml = (res, xml) => res.type('application/xml')
  .set('Cache-Control', 'public, max-age=60').send(xml);

router.get('/sitemap.xml', (_req, res) => sendXml(res, sitemapIndex()));
router.get('/sitemaps/:file', async (req, res) => {
  const type = req.params.file.replace(/\.xml$/, '');
  if (!TYPES.includes(type) || req.params.file !== `${type}.xml`) {
    return res.status(404).json({ error: 'Unknown sitemap' });
  }
  try {
    const data = {};
    if (type !== 'pages') data.teams = await Team.find({}, {
      slug: 1, name: 1, 'story.status': 1, 'story.updated_at': 1, 'story.published_at': 1
    }).lean();
    if (type === 'teams' || type === 'pages') {
      data.snapshots = await NewsCollectionSnapshot.find({}).lean();
    }
    if (type === 'matches') {
      data.matches = await Match.find({}, {
        match_id: 1, teams: 1, 'match_info.starting_at': 1, date: 1,
        match_status: 1, periods: 1, structured_data_frozen_at: 1, createdAt: 1
      }).lean();
    }
    if (type === 'reports') {
      data.reports = await Report.aggregate([
        ...publicReportStages(),
        { $project: {
          match_id: 1, team_slug: 1, headline: 1, 'generated.headline': 1,
          createdAt: 1, updatedAt: 1, 'match.teams': 1, 'match.reports': 1
        } }
      ]);
    }
    return sendXml(res, sitemapXml(entriesFor(type, data)));
  } catch (error) {
    console.error(`[sitemap] Failed to generate ${type}:`, error);
    return res.status(503).set('Cache-Control', 'no-store').json({ error: 'Sitemap temporarily unavailable' });
  }
});

module.exports = router;
