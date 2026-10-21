const policy = require('../services/coveragePolicy');

function failure(res, error) {
  res.set('Cache-Control', 'no-store');
  return res.status(error.statusCode || error.status || 503).json({ error: error.message });
}

async function loadCoverage(req, res, next) {
  try {
    req.coverage = await policy.getCoverage();
    res.set('Cache-Control', 'no-store');
    next();
  } catch (error) {
    failure(res, error);
  }
}

function guard(assertion) {
  return async (req, res, next, value) => {
    if (!['GET', 'HEAD'].includes(req.method)) return next();
    try {
      await assertion(value);
      next();
    } catch (error) {
      failure(res, error);
    }
  };
}

function protectRouter(router, { teams = [], matches = [], competitions = [], queryTeams = [], queryCompetitions = [] } = {}) {
  const get = router.get.bind(router);
  const queryGuard = async (req, res, next) => {
    try {
      for (const key of queryTeams) if (req.query[key]) await policy.assertPublicTeam(req.query[key]);
      for (const key of queryCompetitions) if (req.query[key]) await policy.assertPublicCompetition(req.query[key]);
      next();
    } catch (error) {
      failure(res, error);
    }
  };
  router.get = (path, ...handlers) => get(path, loadCoverage, queryGuard, ...handlers);
  teams.forEach(key => {
    router.param(key, require('./resolveTeamSlugParam').resolveTeamSlugParam);
    router.param(key, guard(value => policy.assertPublicTeam(value)));
  });
  matches.forEach(key => router.param(key, guard(value => policy.assertPublicMatch(value))));
  competitions.forEach(key => router.param(key, guard(value => policy.assertPublicCompetition(value))));
}

module.exports = { loadCoverage, protectRouter };
