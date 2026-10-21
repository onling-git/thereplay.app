const Team = require('../models/Team');
const { normalizeTeamSlug, buildTeamSlugCandidates, slugifyTeamName, legacySlugifyTeamName } = require('../utils/teamSlug');

const resolveTeamSlugParam = async (req, _res, next, rawValue, paramName) => {
  const requestedSlug = normalizeTeamSlug(rawValue);
  if (!requestedSlug) {
    req.params[paramName] = '';
    return next();
  }
  if (!requestedSlug.includes('-and-') && !requestedSlug.includes('--')) {
    req.params[paramName] = requestedSlug;
    return next();
  }

  try {
    const exact = await Team.findOne({ slug: requestedSlug }, { slug: 1 }).lean();
    if (exact) {
      req.params[paramName] = exact.slug;
      return next();
    }
    const candidates = buildTeamSlugCandidates(requestedSlug);
    const teams = await Team.find({ slug: { $in: candidates } }).select('slug name').lean();
    const matches = teams.filter(team => {
      const legacy = legacySlugifyTeamName(team.name);
      const aliases = [slugifyTeamName(team.name), legacy, legacy.replace(/-+/g, '-')];
      return aliases.includes(requestedSlug) && aliases.includes(team.slug);
    });
    if (matches.length > 1) {
      return next(Object.assign(new Error('Team URL is ambiguous.'), { status: 409 }));
    }
    req.params[paramName] = matches[0]?.slug || requestedSlug;
  } catch (error) {
    return next(error);
  }

  return next();
};

module.exports = { resolveTeamSlugParam };
