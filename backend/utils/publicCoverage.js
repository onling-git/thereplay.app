const policy = require('../services/coveragePolicy');

const and = (filter, scope) => ({ $and: [filter || {}, scope] });
const matchFilter = async (filter = {}, prefix = '') => and(filter, await policy.publicMatchFilter(prefix));
const teamFilter = async (filter = {}) => and(filter, await policy.publicTeamFilter());
const idVariants = ids => [...new Set(ids.flatMap(id => [Number(id), String(id)]))];

function markMatch(match, coverage) {
  if (!match) return match;
  const supported = new Set(coverage.teamIds.map(String));
  const competitionId = match.match_info?.league?.id ?? match.league?.id ?? match.competition?.id;
  const reportsEnabled = coverage.reportCompetitionIds.some(id => String(id) === String(competitionId));
  const result = { ...match, supported: true };
  if (match.teams) {
    result.teams = { ...match.teams };
    for (const side of ['home', 'away']) {
      if (match.teams[side]) result.teams[side] = {
        ...match.teams[side], supported: supported.has(String(match.teams[side].team_id)),
        ...(match.teams[side].has_report !== undefined ? {
          has_report: Boolean(match.teams[side].has_report && reportsEnabled && supported.has(String(match.teams[side].team_id)))
        } : {})
      };
    }
  }
  if (match.reports) {
    result.reports = { ...match.reports };
    for (const side of ['home', 'away']) {
      if (!reportsEnabled || result.teams?.[side]?.supported === false) result.reports[side] = null;
    }
  }
  return result;
}

function matchFlags(coverage) {
  const ids = idVariants(coverage.teamIds);
  return { $addFields: {
    supported: true,
    'teams.home.supported': { $in: ['$teams.home.team_id', ids] },
    'teams.away.supported': { $in: ['$teams.away.team_id', ids] }
  } };
}

function markTeamSnapshot(team, coverage) {
  const result = { ...team, supported: true };
  for (const key of ['last_match_info', 'next_match_info']) {
    const snapshot = team[key];
    if (snapshot) result[key] = {
      ...snapshot,
      opponent_supported: snapshot.opponent_id != null
        ? coverage.teamIds.some(id => String(id) === String(snapshot.opponent_id))
        : coverage.teams.some(team => team.slug === snapshot.opponent_slug)
    };
    result[key === 'last_match_info' ? 'last_match' : 'next_match'] = snapshot?.match_id || null;
  }
  return result;
}

module.exports = { and, matchFilter, teamFilter, idVariants, markMatch, matchFlags, markTeamSnapshot };
