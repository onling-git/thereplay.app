// controllers/teamController.js
const Team = require('../models/Team');
const Match = require('../models/Match');
const { getDynamicTeamMatchInfo, getTeamMatchesFromDb, getTeamWithMatchReferences, createLastMatchSnapshot, createNextMatchSnapshot } = require('../utils/teamMatchUtils');

const toSlug = s =>
  String(s || '').trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

// Helper functions for cache metadata
function computeCacheStale(cachedAt) {
  if (!cachedAt) return true;
  const CACHE_TTL_MS = Number(process.env.TEAM_CACHE_TTL_MS || 6 * 60 * 60 * 1000); // 6 hours default
  const now = new Date();
  const cacheAge = now.getTime() - new Date(cachedAt).getTime();
  return cacheAge > CACHE_TTL_MS;
}

function computeCacheAge(cachedAt) {
  if (!cachedAt) return null;
  const now = new Date();
  const ageMs = now.getTime() - new Date(cachedAt).getTime();
  return Math.round(ageMs / (60 * 1000));
}

// Internal: try to find last finished and next upcoming match using multiple fallback strategies
async function findMatchesForTeam(slug, teamName) {
  // Use the new utility function for consistency
  return await getTeamMatchesFromDb(slug, teamName);
}

function safeNum(v) {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// Strip draft Team Story content from public responses - only published stories are visible
function getPublicTeamStory(story) {
  if (!story || story.status !== 'published' || !story.content) return null;
  return {
    content: story.content,
    published_at: story.published_at || null
  };
}

/**
 * Recompute and persist snapshot for a single team slug
 */
async function recomputeTeamSnapshotInternal(teamSlug) {
  const slug = toSlug(teamSlug);
  const team = await Team.findOne({ slug }).lean();
  if (!team) throw Object.assign(new Error(`Team not found: ${teamSlug}`), { statusCode: 404 });

  const teamName = team.name || '';

  const { lastFinished, nextUpcoming } = await findMatchesForTeam(slug, teamName);

  // Use the shared snapshot builders — they handle the nested teams.* schema and
  // correct date priority. (The previous inline logic read flat home_team/away_team
  // fields that no longer exist, producing empty opponents and wrong dates.)
  const lastSnap = createLastMatchSnapshot(lastFinished, slug);
  const nextSnap = createNextMatchSnapshot(nextUpcoming, slug);

  const update = {
    last_match_info: lastSnap,
    next_match_info: nextSnap,
    last_played_at: lastSnap?.date ? new Date(lastSnap.date) : null,
    next_game_at: nextSnap?.date ? new Date(nextSnap.date) : null,
    // Keep the numeric match references in sync too — the primary read path
    // (getTeamWithMatchReferences) resolves via these, not the embedded snapshots
    last_match: lastFinished ? safeNum(lastFinished.match_id) : null,
    next_match: nextUpcoming ? safeNum(nextUpcoming.match_id) : null
  };

  // Add cache metadata
  const computationEnd = Date.now();
  const cacheMetadata = {
    cached_at: new Date(),
    cache_version: 1, // Will be incremented in the update operation
    last_computed_by: 'internal',
    computation_duration_ms: computationEnd - Date.now() // Will be updated properly in actual implementation
  };

  // Persist using findOneAndUpdate to avoid race conditions
  const updated = await Team.findOneAndUpdate(
    { slug },
    {
      $set: {
        last_match_info: update.last_match_info,
        next_match_info: update.next_match_info,
        last_played_at: update.last_played_at,
        next_game_at: update.next_game_at,
        last_match: update.last_match,
        next_match: update.next_match,
        'cache_metadata.cached_at': cacheMetadata.cached_at,
        'cache_metadata.last_computed_by': cacheMetadata.last_computed_by,
        'cache_metadata.computation_duration_ms': cacheMetadata.computation_duration_ms
      },
      $inc: {
        'cache_metadata.cache_version': 1
      }
    },
    { new: true }
  ).lean();

  return {
    ok: true,
    team: { slug: updated.slug, name: updated.name, id: updated.id },
    snapshot: update,
    cache_metadata: updated.cache_metadata
  };
}

// Exposed for local batch scripts (e.g. recompute snapshots after data backfills)
exports.recomputeTeamSnapshotInternal = recomputeTeamSnapshotInternal;

// Express handlers

exports.recomputeTeamSnapshot = async (req, res) => {
  try {
    const teamSlug = req.params.teamSlug;
    const result = await recomputeTeamSnapshotInternal(teamSlug);
    res.json(result);
  } catch (err) {
    console.error('recomputeTeamSnapshot error:', err?.message || err);
    const status = err?.statusCode || 500;
    res.status(status).json({ error: 'Failed to recompute team snapshot', detail: err?.message || String(err) });
  }
};

/**
 * Return team document by slug with populated match references (public)
 */
exports.getTeamSnapshot = async (req, res) => {
  try {
    const teamSlug = String(req.params.teamSlug || '').trim().toLowerCase();
    if (!teamSlug) return res.status(400).json({ error: 'Missing team slug' });

    const team = await Team.findOne({ slug: teamSlug }).lean();
      
    if (!team) return res.status(404).json({ error: 'Team not found', slug: teamSlug });

    let dynamicMatchInfo = null;
    try {
      dynamicMatchInfo = await getDynamicTeamMatchInfo(teamSlug, team.name || '');
    } catch (err) {
      console.warn('getTeamSnapshot dynamic lookup failed:', err?.message || err);
    }

    // Resolve match references manually
    let lastMatch = null;
    let nextMatch = null;
    
    if (team.last_match) {
      lastMatch = await Match.findOne({ match_id: team.last_match }).lean();
    }
    
    if (team.next_match) {
      nextMatch = await Match.findOne({ match_id: team.next_match }).lean();
    }

    // Format resolved matches for compatibility
    const { formatMatchForCompatibility } = require('../utils/teamMatchUtils');
    const hasDynamicInfo = dynamicMatchInfo && Object.prototype.hasOwnProperty.call(dynamicMatchInfo, 'last_match_info');
    const formattedTeam = {
      ...team,
      last_match_info: hasDynamicInfo
        ? dynamicMatchInfo.last_match_info
        : (formatMatchForCompatibility(lastMatch, teamSlug, false) || team.last_match_info),
      next_match_info: hasDynamicInfo
        ? dynamicMatchInfo.next_match_info
        : (formatMatchForCompatibility(nextMatch, teamSlug, true) || team.next_match_info),
      last_played_at: hasDynamicInfo ? dynamicMatchInfo.last_played_at : team.last_played_at,
      next_game_at: hasDynamicInfo ? dynamicMatchInfo.next_game_at : team.next_game_at
    };

    // Add cache freshness indicators (since lean() doesn't include virtuals)
    const teamWithCacheInfo = {
      ...formattedTeam,
      cache_is_stale: computeCacheStale(team.cache_metadata?.cached_at),
      cache_age_minutes: computeCacheAge(team.cache_metadata?.cached_at),
      _cache_info: {
        using_cached_data: true,
        using_match_references: true,
        cache_ttl_hours: Number(process.env.TEAM_CACHE_TTL_MS || 6 * 60 * 60 * 1000) / (60 * 60 * 1000),
        last_computed_by: team.cache_metadata?.last_computed_by || 'unknown'
      },
      // Only expose the story publicly once it has been published (never leak drafts)
      story: getPublicTeamStory(team.story)
    };

    res.json(teamWithCacheInfo);
  } catch (err) {
    console.error('getTeamSnapshot error:', err?.message || err);
    res.status(500).json({ error: 'Failed to get team', detail: err?.message || String(err) });
  }
};

/**
 * Return team with current match info using the new reference-based approach
 * This uses populate to get match details from the referenced documents
 */
exports.getTeamWithCurrentMatches = async (req, res) => {
  try {
    const teamSlug = String(req.params.teamSlug || '').trim().toLowerCase();
    if (!teamSlug) return res.status(400).json({ error: 'Missing team slug' });

    // Try the new reference-based approach first
    let team = await getTeamWithMatchReferences(teamSlug);
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found', slug: teamSlug });
    }

    // Fallback to dynamic computation if references are missing
    if (!team.last_match_info && !team.next_match_info) {
      const dynamicMatchInfo = await getDynamicTeamMatchInfo(teamSlug, team.name);
      team = {
        ...team,
        ...dynamicMatchInfo
      };
    }

    // Add cache metadata for compatibility
    const teamWithMetadata = {
      ...team,
      cache_is_stale: computeCacheStale(team.cache_metadata?.cached_at),
      cache_age_minutes: computeCacheAge(team.cache_metadata?.cached_at),
      _cache_info: {
        using_cached_data: false,
        computed_via_references: true,
        computed_at: new Date().toISOString(),
        cache_last_updated: team.cache_metadata?.cached_at || null,
        cache_version: team.cache_metadata?.cache_version || null
      },
      // Only expose the story publicly once it has been published (never leak drafts)
      story: getPublicTeamStory(team.story)
    };

    res.json(teamWithMetadata);
  } catch (err) {
    console.error('getTeamWithCurrentMatches error:', err?.message || err);
    res.status(500).json({ error: 'Failed to get team with current matches', detail: err?.message || String(err) });
  }
};

exports.listTeams = async (req, res) => {
  try {
    const { 
      search, 
      country_id, 
      league_id, 
      limit = 100,
      offset = 0,
      sort = 'name'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { short_code: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (country_id) {
      filter.country_id = parseInt(country_id);
    }
    
    // Note: league_id filtering would require match data analysis
    // For now, we'll just filter by country and search
    
    const sortOptions = {};
    sortOptions[sort] = 1;
    
    const teams = await Team.find(filter)
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .lean();
      
    const total = await Team.countDocuments(filter);
    
    res.json({
      teams: teams.map(t => ({ ...t, story: getPublicTeamStory(t.story) })),
      pagination: {
        total,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < total
      }
    });
  } catch (err) {
    console.error('listTeams error:', err);
    res.status(500).json({ error: 'Failed to list teams' });
  }
};

// Get countries that have teams in our database
exports.getCountries = async (req, res) => {
  try {
    // First get country IDs and team counts from Teams collection
    const teamCountsByCountry = await Team.aggregate([
      { $match: { country_id: { $exists: true, $ne: null } } },
      { $group: { 
        _id: '$country_id',
        count: { $sum: 1 }
      }},
      { $sort: { _id: 1 } }
    ]);
    
    const countryIds = teamCountsByCountry.map(c => c._id);
    
    // Fetch country names from Country collection
    const Country = require('../models/Country');
    const countryDocuments = await Country.find(
      { id: { $in: countryIds } },
      'id name'
    ).lean();
    
    // Create a mapping of country_id to name
    const countryNameMap = {};
    countryDocuments.forEach(country => {
      countryNameMap[country.id] = country.name;
    });
    
    // Combine team counts with country names
    const countries = teamCountsByCountry.map(item => ({
      id: item._id,
      name: countryNameMap[item._id] || `Country ${item._id}`,
      team_count: item.count
    }));
    
    // Sort by country name
    countries.sort((a, b) => a.name.localeCompare(b.name));
    
    res.json(countries);
  } catch (err) {
    console.error('getCountries error:', err);
    res.status(500).json({ error: 'Failed to get countries' });
  }
};

exports.recomputeAllTeams = async (req, res) => {
  try {
    const perBatch = Number(req.body?.perBatch) || 20;
    const delayMs = Number(req.body?.delayMs) || 300;
    const teams = await Team.find({}, { slug: 1, name: 1 }).lean();

    const results = { total: teams.length, processed: 0, errors: 0, details: [] };

    for (let i = 0; i < teams.length; i += perBatch) {
      const batch = teams.slice(i, i + perBatch);
      await Promise.all(batch.map(async (t) => {
        try {
          await recomputeTeamSnapshotInternal(t.slug);
          results.details.push({ slug: t.slug, ok: true });
          results.processed++;
        } catch (e) {
          console.error(`[recomputeAll] ${t.slug} failed`, e?.message || e);
          results.details.push({ slug: t.slug, ok: false, error: e?.message || String(e) });
          results.errors++;
        }
      }));
      await new Promise(r => setTimeout(r, delayMs));
    }

    res.json(results);
  } catch (err) {
    console.error('recomputeAllTeams error:', err?.message || err);
    res.status(500).json({ error: 'Failed to recompute all teams', detail: err?.message || String(err) });
  }
};

/**
 * Get all cup competitions a team is participating in (excluding league)
 * @route GET /api/teams/:teamSlug/competitions
 */
exports.getTeamCompetitions = async (req, res) => {
  try {
    const teamSlug = String(req.params.teamSlug || '').trim().toLowerCase();
    if (!teamSlug) return res.status(400).json({ error: 'Missing team slug' });

    // Find the team
    const team = await Team.findOne({ slug: teamSlug }).lean();
    if (!team) return res.status(404).json({ error: 'Team not found', slug: teamSlug });

    const CupCompetition = require('../models/CupCompetition');
    
    // Find all cup competitions where the team appears in any stage
    const cupCompetitions = await CupCompetition.find({
      $or: [
        { 'stages.fixtures.home_team_id': team.id },
        { 'stages.fixtures.away_team_id': team.id },
        { 'stages.teams_remaining.team_id': team.id }
      ]
    }).lean();

    const competitions = [];

    for (const cup of cupCompetitions) {
      // Find all stages where the team participated
      const teamStages = cup.stages.filter(stage => {
        const hasFixture = stage.fixtures?.some(
          f => f.home_team_id === team.id || f.away_team_id === team.id
        );
        const isInRemaining = stage.teams_remaining?.some(t => t.team_id === team.id);
        return hasFixture || isInRemaining;
      }).map(stage => {
        const teamFixture = stage.fixtures?.find(
          f => f.home_team_id === team.id || f.away_team_id === team.id
        );
        return {
          ...stage,
          teamFixture,
          isInRemaining: stage.teams_remaining?.some(t => t.team_id === team.id)
        };
      });

      if (teamStages.length === 0) continue;

      // Find the latest relevant stage based on fixture dates
      // Priority: upcoming fixtures (future dates) > most recent finished fixture
      const now = new Date();
      const upcomingStages = teamStages.filter(s => {
        const fixtureDate = s.teamFixture?.date ? new Date(s.teamFixture.date) : null;
        return fixtureDate && fixtureDate > now;
      });
      
      let latestStage = null;
      let isStillIn = false;

      if (upcomingStages.length > 0) {
        // Find the earliest upcoming fixture (next match)
        latestStage = upcomingStages.sort((a, b) => {
          const dateA = new Date(a.teamFixture.date);
          const dateB = new Date(b.teamFixture.date);
          return dateA - dateB;
        })[0];
        isStillIn = true;
      } else {
        // All fixtures finished, find the most recent one
        latestStage = teamStages.sort((a, b) => {
          const dateA = a.teamFixture?.date ? new Date(a.teamFixture.date) : new Date(0);
          const dateB = b.teamFixture?.date ? new Date(b.teamFixture.date) : new Date(0);
          return dateB - dateA;
        })[0];
        
        // Check if team won their last fixture
        if (latestStage.teamFixture?.winner_team_id === team.id) {
          isStillIn = true;
        } else if (latestStage.isInRemaining) {
          isStillIn = true;
        } else {
          isStillIn = false;
        }
      }

      if (latestStage) {
        competitions.push({
          competition_id: cup.league_id,
          competition_name: cup.league_name,
          competition_slug: cup.league_slug,
          competition_image: cup.league_image,
          season_id: cup.season_id,
          season_name: cup.season_name,
          current_stage: latestStage.stage_name,
          stage_id: latestStage.stage_id,
          is_still_participating: isStillIn,
          last_updated: cup.last_synced
        });
      }
    }

    // Sort by whether still participating, then by competition name
    competitions.sort((a, b) => {
      if (a.is_still_participating !== b.is_still_participating) {
        return b.is_still_participating ? 1 : -1;
      }
      return (a.competition_name || '').localeCompare(b.competition_name || '');
    });

    res.json({
      ok: true,
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug
      },
      competitions
    });

  } catch (err) {
    console.error('getTeamCompetitions error:', err?.message || err);
    res.status(500).json({ 
      ok: false, 
      error: 'Failed to get team competitions', 
      detail: err?.message || String(err) 
    });
  }
};
