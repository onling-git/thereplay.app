// controllers/teamController.js
const Team = require('../models/Team');
const Match = require('../models/Match');
const { getDynamicTeamMatchInfo, getTeamMatchesFromDb, getTeamWithMatchReferences } = require('../utils/teamMatchUtils');

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

/**
 * Recompute and persist snapshot for a single team slug
 */
async function recomputeTeamSnapshotInternal(teamSlug) {
  const slug = toSlug(teamSlug);
  const team = await Team.findOne({ slug }).lean();
  if (!team) throw Object.assign(new Error(`Team not found: ${teamSlug}`), { statusCode: 404 });

  const teamName = team.name || '';

  const { lastFinished, nextUpcoming } = await findMatchesForTeam(slug, teamName);

  const update = {
    last_match_info: null,
    next_match_info: null,
    last_played_at: null,
    next_game_at: null
  };

  if (lastFinished) {
    // decide whether the team was home
    const isHome = String((lastFinished.home_team_slug || lastFinished.home_team || '')).trim().toLowerCase() === slug;
    const opponent = isHome ? lastFinished.away_team : lastFinished.home_team;
    const goalsFor = isHome ? safeNum(lastFinished.score?.home) ?? 0 : safeNum(lastFinished.score?.away) ?? 0;
    const goalsAgainst = isHome ? safeNum(lastFinished.score?.away) ?? 0 : safeNum(lastFinished.score?.home) ?? 0;
    const win = goalsFor > goalsAgainst;

    update.last_match_info = {
      opponent_name: opponent || '',
      goals_for: goalsFor,
      goals_against: goalsAgainst,
      win: !!win,
    date: lastFinished.date ? new Date(lastFinished.date) : (lastFinished.match_info && lastFinished.match_info.starting_at ? new Date(lastFinished.match_info.starting_at) : null),
      match_id: safeNum(lastFinished.match_id) ?? null,
      match_oid: lastFinished._id || null,
      home_game: !!isHome
    };
    update.last_played_at = lastFinished.date ? new Date(lastFinished.date) : null;
  }

  if (nextUpcoming) {
    const isHome = String((nextUpcoming.home_team_slug || nextUpcoming.home_team || '')).trim().toLowerCase() === slug;
    const opponent = isHome ? nextUpcoming.away_team : nextUpcoming.home_team;

    update.next_match_info = {
      opponent_name: opponent || '',
      goals_for: 0,
      goals_against: 0,
      date: nextUpcoming.date ? new Date(nextUpcoming.date) : (nextUpcoming.match_info && nextUpcoming.match_info.starting_at ? new Date(nextUpcoming.match_info.starting_at) : null),
      match_id: safeNum(nextUpcoming.match_id) ?? null,
      match_oid: nextUpcoming._id || null,
      home_game: !!isHome
    };
    update.next_game_at = nextUpcoming.date ? new Date(nextUpcoming.date) : (nextUpcoming.match_info && nextUpcoming.match_info.starting_at ? new Date(nextUpcoming.match_info.starting_at) : null);
  }

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
    const formattedTeam = {
      ...team,
      last_match_info: formatMatchForCompatibility(lastMatch, teamSlug, false) || team.last_match_info,
      next_match_info: formatMatchForCompatibility(nextMatch, teamSlug, true) || team.next_match_info
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
      }
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
      }
    };

    res.json(teamWithMetadata);
  } catch (err) {
    console.error('getTeamWithCurrentMatches error:', err?.message || err);
    res.status(500).json({ error: 'Failed to get team with current matches', detail: err?.message || String(err) });
  }
};

exports.listTeams = async (req, res) => {
  try {
    const teams = await Team.find({}).sort({ name: 1 }).lean();
    res.json(teams);
  } catch (err) {
    console.error('listTeams error:', err);
    res.status(500).json({ error: 'Failed to list teams' });
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
