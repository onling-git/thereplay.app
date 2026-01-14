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

    // This was a temporary approach - the frontend should use individual match fetches instead
    res.json({
      team: {
        name: team.name,
        slug: team.slug,
        image_path: team.image_path,
        last_match: team.last_match,
        next_match: team.next_match,
        last_played_at: team.last_played_at,
        next_game_at: team.next_game_at
      }
    });
  } catch (e) {
    console.error('overview error:', e);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
