function publicReportStages(teamSlug) {
  return [
    { $match: {
      ...(teamSlug ? { team_slug: teamSlug } : {}),
      $or: [{ 'generated.headline': { $regex: '\\S' } }, { headline: { $regex: '\\S' } }]
    } },
    { $lookup: {
      from: 'matches', localField: 'match_id', foreignField: 'match_id', as: 'match'
    } },
    { $unwind: '$match' },
    { $match: { $expr: { $or: [
      { $eq: ['$_id', '$match.reports.home'] },
      { $eq: ['$_id', '$match.reports.away'] }
    ] } } }
  ];
}

module.exports = { publicReportStages };
