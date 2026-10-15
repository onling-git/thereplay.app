const Team = require('../models/Team');

function currentSeasonFilter(now = new Date()) {
  return {
    $or: [
      {
        'match_info.season.starting_at': { $lte: now },
        'match_info.season.ending_at': { $gte: now },
      },
      {
        'match_info.season.is_current': true,
        $and: [
          { $or: [
            { 'match_info.season.starting_at': null },
            { 'match_info.season.starting_at': { $lte: now } },
          ] },
          { $or: [
            { 'match_info.season.ending_at': null },
            { 'match_info.season.ending_at': { $gte: now } },
          ] },
        ],
      },
    ],
  };
}

async function enrichFixtureBadges(matches) {
  const ids = [...new Set(matches.flatMap((match) =>
    [match.teams?.home?.team_id, match.teams?.away?.team_id]
  ).filter((id) => id != null))];
  const teams = ids.length
    ? await Team.find({ id: { $in: ids } }).select('id image_path slug').lean()
    : [];
  const byId = new Map(teams.map((team) => [String(team.id), team]));
  return matches.map((match) => ({
    ...match,
    teams: Object.fromEntries(['home', 'away'].map((side) => {
      const team = match.teams?.[side];
      const record = byId.get(String(team?.team_id));
      return [side, {
        ...team,
        logo: team?.logo || record?.image_path || null,
        team_slug: team?.team_slug || record?.slug || '',
        has_report: Boolean(match.reports?.[side] && String(match.reports[side]).trim()),
      }];
    })),
  }));
}

module.exports = { currentSeasonFilter, enrichFixtureBadges };
