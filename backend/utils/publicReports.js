async function publicReportStages(teamSlug) {
  const policy = require('../services/coveragePolicy');
  const coverage = await policy.getCoverage();
  return [
    { $match: {
      team_slug: { $in: coverage.teams.map(team => team.slug) },
      ...(teamSlug ? { $and: [{ team_slug: teamSlug }] } : {}),
      $or: [{ 'generated.headline': { $regex: '\\S' } }, { headline: { $regex: '\\S' } }]
    } },
    { $lookup: {
      from: 'matches', localField: 'match_id', foreignField: 'match_id', as: 'match'
    } },
    { $unwind: '$match' },
    { $match: await policy.publicMatchFilter('match.') },
    { $match: { 'match.match_info.league.id': { $in: coverage.reportCompetitionIds.flatMap(id => [id, String(id)]) } } },
    { $match: { $expr: { $or: [
      { $eq: ['$_id', '$match.reports.home'] },
      { $eq: ['$_id', '$match.reports.away'] }
    ] } } }
  ];
}

module.exports = { publicReportStages };
