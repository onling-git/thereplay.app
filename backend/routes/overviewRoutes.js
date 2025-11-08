const router = require('express').Router();
const Team = require('../models/Team');
const Match = require('../models/Match');

const slug = s => String(s||'').toLowerCase().trim();

router.get('/teams/:teamSlug/overview', async (req, res) => {
  try {
    const team = await Team.findOne({ slug: slug(req.params.teamSlug) }).lean();
      
    if (!team) return res.status(404).json({ error: 'Team not found' });

    // Use the new reference-based approach with fallback to old method
    let last = null;
    let next = null;
    
    // Resolve match references manually using match_id
    if (team.last_match) {
      last = await Match.findOne({ match_id: team.last_match }).lean();
    }
    
    if (team.next_match) {
      next = await Match.findOne({ match_id: team.next_match }).lean();
    }

    // Fallback to legacy approach if references are missing
    if (!last && team.last_match_info?.match_id) {
      last = await Match.findOne({ match_id: team.last_match_info.match_id }).lean();
    }
    if (!last) {
      last = await Match.findOne({
        $or: [
          { home_team_slug: team.slug }, 
          { away_team_slug: team.slug },
          { 'teams.home.team_slug': team.slug }, 
          { 'teams.away.team_slug': team.slug }
        ],
        'match_info.starting_at': { $lte: new Date() }
      }).sort({ 'match_info.starting_at': -1 }).lean();
    }

    if (!next && team.next_match_info?.match_id) {
      next = await Match.findOne({ match_id: team.next_match_info.match_id }).lean();
    }
    if (!next) {
      next = await Match.findOne({
        $or: [
          { home_team_slug: team.slug }, 
          { away_team_slug: team.slug },
          { 'teams.home.team_slug': team.slug }, 
          { 'teams.away.team_slug': team.slug }
        ],
        'match_info.starting_at': { $gt: new Date() }
      }).sort({ 'match_info.starting_at': 1 }).lean();
    }

    // Format match info for compatibility
    const { formatMatchForCompatibility } = require('../utils/teamMatchUtils');
    
    res.json({
      team: {
        name: team.name,
        slug: team.slug,
        image_path: team.image_path,
        last_match_info: formatMatchForCompatibility(last, team.slug, false) || team.last_match_info,
        next_match_info: formatMatchForCompatibility(next, team.slug, true) || team.next_match_info,
      },
      lastMatch: last || null,
      nextMatch: next || null,
    });
  } catch (e) {
    console.error('overview error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
