const League = require('../models/League');
const Country = require('../models/Country');
const Team = require('../models/Team');
const Match = require('../models/Match');

function coverageError(message, status = 404) {
  return Object.assign(new Error(message), { status, code: 'OUTSIDE_PUBLIC_COVERAGE' });
}

async function getCoverage() {
  const config = await require('../models/CoverageConfig').findById('public-coverage').lean();
  if (!config?.initialized) throw coverageError('Public coverage is not initialized. Refresh the coverage catalogue in admin.', 503);
  const [competitions, countries] = await Promise.all([
    League.find({ enabled: true, available: true }).lean(),
    Country.find({ enabled: true }).select('id').lean()
  ]);
  const countryIds = new Set(countries.map(country => Number(country.id)));
  const effective = competitions.filter(league => league.coverage_role === 'competition' || countryIds.has(Number(league.country_id)));
  const domestic = effective.filter(league => league.coverage_role === 'league');
  const membershipQueries = domestic.filter(league => league.current_season_id != null).map(league => ({
    league_id: Number(league.id), season_id: Number(league.current_season_id)
  }));
  const memberships = membershipQueries.length
    ? await require('../models/TeamMembership').find({ active: true, $or: membershipQueries }).lean()
    : [];
  const teamIds = [...new Set(memberships.map(member => Number(member.team_id)))];
  const teams = teamIds.length ? await Team.find({ id: { $in: teamIds } }).select('id slug name').lean() : [];
  return {
    initialized: true, teamIds: teams.map(team => Number(team.id)), teams,
    leagueIds: domestic.map(league => Number(league.id)),
    competitionIds: effective.map(league => Number(league.id)),
    reportCompetitionIds: effective.filter(league => league.reports_enabled).map(league => Number(league.id))
  };
}

function matchFilterForCoverage(coverage, prefix = '') {
  const p = prefix ? `${prefix.replace(/\.$/, '')}.` : '';
  const ids = coverage.teamIds.flatMap(id => [id, String(id)]);
  return { $and: [
    { $or: ['match_info.league.id', 'league.id', 'competition.id'].map(field => ({ [p + field]: { $in: coverage.competitionIds } })) },
    { $or: ['teams.home.team_id', 'teams.away.team_id', 'home_team_id', 'away_team_id'].map(field => ({ [p + field]: { $in: ids } })) }
  ] };
}

async function publicMatchFilter(prefix = '') {
  return matchFilterForCoverage(await getCoverage(), prefix);
}

async function publicTeamFilter() {
  return { id: { $in: (await getCoverage()).teamIds } };
}

async function assertPublicTeam(slugOrId) {
  const coverage = await getCoverage();
  const identity = typeof slugOrId === 'number' || /^\d+$/.test(String(slugOrId))
    ? { id: Number(slugOrId) } : { slug: String(slugOrId).trim().toLowerCase() };
  const team = await Team.findOne({ ...identity, $and: [{ id: { $in: coverage.teamIds } }] }).lean();
  if (!team) throw coverageError('Team is not currently covered.');
  return team;
}

async function assertPublicMatch(matchId) {
  const match = await Match.findOne({ match_id: Number(matchId), ...(await publicMatchFilter()) }).lean();
  if (!match) throw coverageError('Match is not currently covered.');
  return match;
}

async function assertPublicCompetition(id) {
  if (!(await getCoverage()).competitionIds.includes(Number(id))) throw coverageError('Competition is not currently covered.');
}

async function assertReportTeam(match, team) {
  const coverage = await getCoverage();
  const leagueId = Number(match.match_info?.league?.id ?? match.league?.id ?? match.competition?.id);
  if (!coverage.teamIds.includes(Number(team?.id)) || !coverage.reportCompetitionIds.includes(leagueId)) {
    throw Object.assign(new Error('Report generation is not enabled for this team and competition.'), {
      status: 403, code: 'REPORT_TEAM_NOT_ELIGIBLE'
    });
  }
  return team;
}

module.exports = { getCoverage, matchFilterForCoverage, publicMatchFilter, publicTeamFilter, assertPublicTeam, assertPublicMatch, assertPublicCompetition, assertReportTeam };
