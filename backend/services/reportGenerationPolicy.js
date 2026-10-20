const Team = require('../models/Team');
const { isFinishedMatch, hasConsistentScore } = require('./reportMatchReadiness');

const ENGLAND_COUNTRY_ID = 462;

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
  if (Number(team?.country_id) !== ENGLAND_COUNTRY_ID) {
    throw Object.assign(new Error(`Reports are limited to English teams; ${teamSlug} is not a confirmed English team.`), {
      status: 403, code: 'REPORT_TEAM_NOT_ELIGIBLE'
    });
  }
  return team;
}

function automaticMatchSkipReason(match) {
  const kickoff = new Date(match.match_info?.starting_at || match.date).getTime();
  if (!Number.isFinite(kickoff) || kickoff > Date.now() || !isFinishedMatch(match) || !hasConsistentScore(match)) {
    return 'Match does not have a confirmed, consistent full-time result.';
  }
  return null;
}

module.exports = { generationDisabledReason, assertGenerationEnabled, assertEnglishReportTeam, automaticMatchSkipReason };
