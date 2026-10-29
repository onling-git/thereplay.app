const { isFinishedMatch } = require('./reportMatchReadiness');

// Raw values stored in match_status.state/short_name/developer_name/name for completed matches.
const FINISHED_STATUS_VALUES = [
  'FT', 'AET', 'FT_PEN', 'FTP', 'AFTER_PENALTIES', 'AFTER_EXTRA_TIME',
  'finished', 'Finished', 'ended', 'full-time', 'Full Time', 'After Extra Time', 'After Penalties'
];

function finishedMatchQuery() {
  return {
    $or: [
      { 'match_status.state': { $in: FINISHED_STATUS_VALUES } },
      { 'match_status.developer_name': { $in: FINISHED_STATUS_VALUES } },
      { 'match_status.short_name': { $in: FINISHED_STATUS_VALUES } },
      { 'match_status.name': { $in: FINISHED_STATUS_VALUES } },
      { match_status: { $in: FINISHED_STATUS_VALUES } }
    ]
  };
}

function isFinishedState(state) {
  return isFinishedMatch({ match_status: String(state || '') });
}

function eventType(event) {
  return String(event?.type || '').toUpperCase().replace(/[\s-]+/g, '_');
}

function isShootoutEvent(event) {
  return eventType(event).startsWith('PENALTY_SHOOTOUT');
}

function eventSide(event, match) {
  const team = String(event?.team ?? '').toLowerCase();
  if (team === 'home' || team === 'away') return team;
  const participant = String(event?.participant_id ?? event?.team_id ?? '');
  if (participant && participant === String(match?.teams?.home?.team_id ?? match?.home_team_id)) return 'home';
  if (participant && participant === String(match?.teams?.away?.team_id ?? match?.away_team_id)) return 'away';
  return null;
}

function getPenaltyShootout(match) {
  const kicks = (match?.events || [])
    .filter(event => isShootoutEvent(event) && event.rescinded !== true)
    .map(event => ({ event, side: eventSide(event, match) }))
    .filter(kick => kick.side)
    .sort((first, second) => Number(first.event.sort_order ?? first.event.minute) - Number(second.event.sort_order ?? second.event.minute))
    .map((kick, index) => ({
      order: index + 1,
      side: kick.side,
      player: kick.event.player_name || kick.event.player || null,
      scored: eventType(kick.event) === 'PENALTY_SHOOTOUT_GOAL'
    }));
  if (!kicks.length) return null;
  const score = kicks.reduce((total, kick) => {
    if (kick.scored) total[kick.side]++;
    return total;
  }, { home: 0, away: 0 });
  if (score.home === score.away) return null;
  return { home: score.home, away: score.away, winner_side: score.home > score.away ? 'home' : 'away', kicks };
}

function getMatchDecision(match) {
  const status = match?.match_status;
  const state = String(typeof status === 'string' ? status : status?.state || status?.developer_name || status?.short_name || status?.name || '')
    .trim().toUpperCase().replace(/[\s-]+/g, '_');
  const penaltyShootout = getPenaltyShootout(match);
  if (penaltyShootout) return { decided_by: 'penalties', penalty_shootout: penaltyShootout };
  if (['AET', 'AFTER_EXTRA_TIME'].includes(state)) return { decided_by: 'extra_time', penalty_shootout: null };
  return { decided_by: 'normal_time', penalty_shootout: null };
}

function focusedOutcome({ score = {}, side, penaltyShootout }) {
  const focused = Number(score[side === 'away' ? 'away' : 'home']);
  const opponent = Number(score[side === 'away' ? 'home' : 'away']);
  if (focused > opponent) return 'won';
  if (focused < opponent) return 'lost';
  if (penaltyShootout) return penaltyShootout.winner_side === (side === 'away' ? 'away' : 'home') ? 'won on penalties' : 'lost on penalties';
  return 'drew';
}

module.exports = { FINISHED_STATUS_VALUES, finishedMatchQuery, isFinishedState, isShootoutEvent, getPenaltyShootout, getMatchDecision, focusedOutcome };
