const Team = require('../models/Team');
const { isFinishedMatch, hasConsistentScore } = require('./reportMatchReadiness');

function generationDisabledReason(env = process.env) {
  if (String(env.REPORT_GENERATION_ENABLED).toLowerCase() === 'false') return 'Report generation is disabled.';
  const environments = [env.NODE_ENV, env.RAILWAY_ENVIRONMENT_NAME];
  if (environments.some(value => /stag(e|ing)/i.test(value || ''))) {
    return 'All report generation is disabled on staging, including manual tests.';
  }
  return null;
}

function assertGenerationEnabled() {
  const reason = generationDisabledReason();
  if (reason) throw Object.assign(new Error(reason), { status: 403, code: 'REPORT_GENERATION_DISABLED' });
}

async function findReportTeam(match, teamSlug) {
  const side = ['home', 'away'].find(side =>
    teamSlug === match.teams?.[side]?.team_slug ||
    teamSlug === match[`${side}_team_slug`] ||
    teamSlug === `__${side}_${match.match_id}`);
  if (!side) return null;
  const id = side && (match.teams?.[side]?.team_id ?? match[`${side}_team_id`]);
  return Team.findOne(id != null ? { id: Number(id) } : { slug: teamSlug }).lean();
}

async function assertEnglishReportTeam(match, teamSlug) {
  const team = await findReportTeam(match, teamSlug);
  if (!team) {
    throw Object.assign(new Error(`Team ${teamSlug} is not a confirmed participant in this match.`), {
      status: 403, code: 'REPORT_TEAM_NOT_ELIGIBLE'
    });
  }
  return require('./coveragePolicy').assertReportTeam(match, team);
}

function automaticMatchSkipReason(match) {
  const kickoff = new Date(match.match_info?.starting_at || match.date).getTime();
  if (!Number.isFinite(kickoff) || kickoff > Date.now() || !isFinishedMatch(match) || !hasConsistentScore(match)) {
    return 'Match does not have a confirmed, consistent full-time result.';
  }
  return null;
}

async function automaticReportSkipReason(match) {
  const reason = automaticMatchSkipReason(match);
  if (reason) return reason;
  const leagueId = Number(match.match_info?.league?.id ?? match.league?.id ?? match.competition?.id);
  const league = await require('../models/League').findOne({ id: leagueId }).select('reports_start_at').lean();
  const kickoff = new Date(match.match_info?.starting_at || match.date).getTime();
  if (league?.reports_start_at && kickoff < new Date(league.reports_start_at).getTime()) {
    return 'Match predates report activation; historical backfill requires explicit regeneration.';
  }
  return null;
}

module.exports = { generationDisabledReason, assertGenerationEnabled, assertEnglishReportTeam, automaticMatchSkipReason, automaticReportSkipReason };
