const FINISHED_STATES = new Set(['FT', 'AET', 'FT_PEN', 'AFTER_PENALTIES', 'FINISHED', 'ENDED', 'FULL_TIME', 'FULLTIME', 'AFTER_EXTRA_TIME']);

function isFinishedMatch(match) {
  const status = match?.match_status;
  const state = typeof status === 'string' ? status : status?.state || status?.developer_name || status?.short_name || status?.name;
  return FINISHED_STATES.has(String(state || '').trim().toUpperCase().replace(/[\s-]+/g, '_'));
}

function hasFinalScore(match) {
  return ['home', 'away'].every(side => {
    const value = match?.score?.[side];
    return value !== null && value !== undefined && value !== '' && Number.isInteger(Number(value)) && Number(value) >= 0;
  });
}

function readinessError(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

function getProviderScore(fixture) {
  const scores = fixture.scores?.data || fixture.scores;
  if (!Array.isArray(scores)) return null;
  const result = {};
  for (const side of ['home', 'away']) {
    const entry = scores.find(score => String(score.description).toUpperCase() === 'CURRENT' && score.score?.participant === side);
    result[side] = entry?.score?.goals;
  }
  return hasFinalScore({ score: result }) ? { home: Number(result.home), away: Number(result.away) } : null;
}

function hasConsistentScore(match) {
  if (!hasFinalScore(match)) return false;
  const scoringEvents = (match.events || []).filter(event => event.rescinded !== true && ['GOAL', 'OWNGOAL', 'OWN_GOAL', 'PENALTY', 'PENALTY_GOAL'].includes(String(event.type).toUpperCase()));
  const latest = scoringEvents.filter(event => /^\d+\s*-\s*\d+$/.test(event.result || '')).sort((first, second) => Number(second.minute) - Number(first.minute) || Number(second.extra_minute || 0) - Number(first.extra_minute || 0))[0];
  if (!latest) return true;
  const [home, away] = latest.result.split('-').map(Number);
  return home === Number(match.score.home) && away === Number(match.score.away);
}

async function loadReportMatch(matchId, {
  loadMatch = id => require('../models/Match').findOne({ match_id: Number(id) }).lean(),
  syncMatch = id => require('../controllers/matchSyncController').syncFinishedMatch(Number(id)),
  now = Date.now()
} = {}) {
  let match = await loadMatch(matchId);
  if (!match) throw readinessError(`Match ${matchId} was not found.`);
  const kickoff = new Date(match.date || match.match_info?.starting_at).getTime();
  if (!Number.isFinite(kickoff) || kickoff > now) {
    throw readinessError(`Match ${matchId} has no valid past kickoff time. A final report cannot be generated.`);
  }
  if ((!isFinishedMatch(match) || !hasConsistentScore(match)) && now - kickoff >= 3 * 60 * 60 * 1000) {
    try {
      await syncMatch(matchId);
      match = await loadMatch(matchId);
    } catch (error) {
      throw readinessError(`Could not refresh match ${matchId}. Final-report generation stopped; retry after the match data has synced.`);
    }
  }
  if (!isFinishedMatch(match) || !hasConsistentScore(match)) {
    throw readinessError(`Match ${matchId} does not have a confirmed full-time result. Final-report generation stopped.`);
  }
  return match;
}

module.exports = { isFinishedMatch, hasFinalScore, hasConsistentScore, getProviderScore, loadReportMatch };