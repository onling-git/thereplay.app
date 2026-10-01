const { isFinishedMatch, hasFinalScore } = require('./reportMatchReadiness');

const eventType = event => String(event.type || '').toUpperCase().replace(/[\s-]+/g, '_');
const SCORING_TYPES = new Set(['GOAL', 'PENALTY', 'PENALTY_GOAL', 'OWNGOAL', 'OWN_GOAL']);
const DISMISSAL_TYPES = new Set(['REDCARD', 'RED_CARD', 'YELLOWREDCARD', 'YELLOW_RED_CARD', 'SECOND_YELLOW']);

function eventsFor(match) {
  const seen = new Set();
  return (match.events || []).filter(event => {
    if (event.rescinded === true) return false;
    const key = event.id ?? JSON.stringify([eventType(event), event.player_id, event.participant_id, event.minute, event.extra_minute, event.result]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sideFor(match, teamId) {
  return ['home', 'away'].find(side => String(match.teams?.[side]?.team_id) === String(teamId));
}

function eventSide(match, event) {
  if (event.participant_id != null) return sideFor(match, event.participant_id);
  return ['home', 'away'].includes(event.team) ? event.team : null;
}

function hasCompleteEvents(match) {
  if (!Array.isArray(match.events) || match.context_events_available === false) return false;
  const scores = { home: 0, away: 0 };
  for (const event of eventsFor(match).filter(event => SCORING_TYPES.has(eventType(event)))) {
    const side = eventSide(match, event);
    if (!side || event.player_id == null) return false;
    scores[side]++;
  }
  return scores.home === Number(match.score?.home) && scores.away === Number(match.score?.away);
}

function outcome(match, teamId) {
  const side = sideFor(match, teamId);
  const goalsFor = Number(match.score[side]);
  const goalsAgainst = Number(match.score[side === 'home' ? 'away' : 'home']);
  return { result: goalsFor > goalsAgainst ? 'W' : goalsFor < goalsAgainst ? 'L' : 'D', goals_for: goalsFor, goals_against: goalsAgainst };
}

function statistics(matches, teamId) {
  const totals = { played: 0, wins: 0, draws: 0, losses: 0, goals_for: 0, goals_against: 0, clean_sheets: 0 };
  for (const match of matches) {
    const result = outcome(match, teamId);
    totals.played++;
    totals[{ W: 'wins', D: 'draws', L: 'losses' }[result.result]]++;
    totals.goals_for += result.goals_for;
    totals.goals_against += result.goals_against;
    if (result.goals_against === 0) totals.clean_sheets++;
  }
  return totals;
}

function trailing(matches, predicate) {
  const result = [];
  for (const match of [...matches].reverse()) {
    if (!predicate(match)) break;
    result.push(match);
  }
  return result.reverse();
}

function buildHistoricalContext({ match, histories = [] }) {
  const kickoff = new Date(match.date || match.match_info?.starting_at).getTime();
  const seasonId = match.match_info?.season?.id;
  const leagueId = match.match_info?.league?.id;
  const context = {
    version: 'report-history-2026-10-01.1',
    as_of_match_id: match.match_id,
    as_of: new Date(kickoff).toISOString(),
    season_id: seasonId,
    competition_id: leagueId,
    competition_name: match.match_info?.league?.name,
    scope: 'Same club, competition and season; includes this match, excludes later fixtures. Scoring streaks count consecutive team matches, not appearances.',
    teams: [],
    players: [],
    facts: []
  };
  for (const side of ['home', 'away']) {
    const team = match.teams?.[side];
    if (team?.team_id == null) continue;
    const history = histories.find(item => String(item.team_id) === String(team.team_id));
    const seen = new Set();
    const prior = (history?.matches || []).filter(fixture => {
      if (seen.has(fixture.match_id)) return false;
      seen.add(fixture.match_id);
      return String(fixture.match_id) !== String(match.match_id) &&
        new Date(fixture.date || fixture.match_info?.starting_at).getTime() < kickoff &&
        String(fixture.match_info?.season?.id) === String(seasonId) &&
        String(fixture.match_info?.league?.id) === String(leagueId) && sideFor(fixture, team.team_id);
    }).sort((first, second) => new Date(first.date || first.match_info?.starting_at) - new Date(second.date || second.match_info?.starting_at));
    const complete = Boolean(seasonId && leagueId && history?.complete) && [...prior, match].every(fixture => isFinishedMatch(fixture) && hasFinalScore(fixture));
    const teamContext = { team_id: team.team_id, team_name: team.team_name, coverage: { complete, source: history?.source || null, fetched_at: history?.fetched_at || null, reason: complete ? null : history?.reason || 'Incomplete fixture or result history; no season totals or streak claims permitted.' } };
    context.teams.push(teamContext);
    if (!complete) continue;
    const all = [...prior, match];
    teamContext.before_match = statistics(prior, team.team_id);
    teamContext.after_match = statistics(all, team.team_id);
    teamContext.source_match_ids = all.map(fixture => fixture.match_id);
    teamContext.recent_form = all.slice(-5).map(fixture => ({ match_id: fixture.match_id, ...outcome(fixture, team.team_id) }));
    const addFact = (kind, text, sources, playerId) => context.facts.push({
      fact_id: `${team.team_id}:${playerId || 'team'}:${kind}`,
      kind, team_id: team.team_id, player_id: playerId || null, text,
      source_match_ids: sources.map(fixture => fixture.match_id),
      season_id: seasonId, competition_id: leagueId, includes_current_match: true
    });
    const competition = match.match_info?.league?.name || 'this competition';
    const previousWinless = trailing(prior, fixture => outcome(fixture, team.team_id).result !== 'W');
    if (outcome(match, team.team_id).result === 'W' && previousWinless.length >= 3) {
      addFact('winless_run_ended', `${team.team_name} ended a ${previousWinless.length}-match winless run in ${competition} this season.`, [...prior.slice(-previousWinless.length - 1), match]);
    }
    for (const [kind, predicate, description] of [
      ['winning_run', fixture => outcome(fixture, team.team_id).result === 'W', 'wins'],
      ['clean_sheet_run', fixture => outcome(fixture, team.team_id).goals_against === 0, 'clean sheets']
    ]) {
      const run = trailing(all, predicate);
      if (run.length >= 3) addFact(kind, `${team.team_name} have recorded ${run.length} consecutive ${description} in ${competition} this season.`, all.slice(-run.length - 1));
    }
    const eventCoverage = all.every(hasCompleteEvents);
    teamContext.coverage.events_complete = eventCoverage;
    if (!eventCoverage) continue;
    const currentEvents = eventsFor(match).filter(event => eventSide(match, event) === side && event.player_id != null);
    const relevant = currentEvents.filter(event => ['GOAL', 'PENALTY', 'PENALTY_GOAL'].includes(eventType(event)) || DISMISSAL_TYPES.has(eventType(event)));
    const playerIds = [...new Set(relevant.map(event => String(event.player_id)))];
    for (const playerId of playerIds) {
      const playerName = relevant.find(event => String(event.player_id) === playerId).player_name || relevant.find(event => String(event.player_id) === playerId).player;
      if (!playerName) continue;
      const playerEvents = fixture => eventsFor(fixture).filter(event => String(event.player_id) === playerId && eventSide(fixture, event) === sideFor(fixture, team.team_id));
      const goals = fixture => playerEvents(fixture).filter(event => ['GOAL', 'PENALTY', 'PENALTY_GOAL'].includes(eventType(event))).length;
      const dismissed = fixture => playerEvents(fixture).some(event => DISMISSAL_TYPES.has(eventType(event)));
      const scoringRun = trailing(all, fixture => goals(fixture) > 0);
      const dismissals = all.filter(dismissed);
      context.players.push({ player_id: playerId, player_name: playerName, team_id: team.team_id, season_goals_for_club: all.reduce((sum, fixture) => sum + goals(fixture), 0), season_dismissals_for_club: dismissals.length, consecutive_team_matches_scored_in: scoringRun.length, source_match_ids: all.map(fixture => fixture.match_id) });
      if (scoringRun.length >= 3) addFact('player_scoring_run', `${playerName} has scored in ${scoringRun.length} consecutive ${competition} matches for ${team.team_name} this season.`, all.slice(-scoringRun.length - 1), playerId);
      if (dismissed(match) && dismissals.length >= 2) addFact('repeat_dismissal', `${playerName} has now been sent off ${dismissals.length} times for ${team.team_name} in ${competition} this season.`, dismissals, playerId);
    }
  }
  return context;
}

async function fetchTeamHistory(match, teamId, get) {
  const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
  const seasonId = match.match_info?.season?.id;
  const leagueId = match.match_info?.league?.id;
  if (!seasonId || !leagueId) throw new Error('Missing competition or season');
  let seasonStart = match.match_info?.season?.starting_at;
  if (!seasonStart) {
    const response = await get(`seasons/${seasonId}`);
    if (String(response.data?.data?.id) !== String(seasonId)) throw new Error('Season mismatch');
    seasonStart = response.data.data.starting_at;
  }
  const start = new Date(seasonStart).getTime();
  const end = new Date(match.date || match.match_info?.starting_at).getTime();
  const day = 86400000;
  if (!seasonStart || !Number.isFinite(start) || start > end || end - start > 550 * day) throw new Error('Invalid season date range');
  const fixtures = new Map();
  for (let rangeStart = Math.floor(start / day) * day; rangeStart <= end; rangeStart += 90 * day) {
    const from = new Date(rangeStart).toISOString().slice(0, 10);
    const to = new Date(Math.min(rangeStart + 89 * day, end)).toISOString().slice(0, 10);
    for (let page = 1; page <= 10; page++) {
      const response = await get(`fixtures/between/${from}/${to}/${teamId}`, { include: 'participants;scores;state;events', per_page: 50, page });
      const data = response.data;
      if (!Array.isArray(data?.data) || typeof data.pagination?.has_more !== 'boolean') throw new Error('Unverified fixture pagination');
      for (const raw of data.data) {
        if (!raw.id || !raw.season_id || !raw.league_id) throw new Error('Missing fixture scope');
        if (String(raw.season_id) !== String(seasonId) || String(raw.league_id) !== String(leagueId)) continue;
        if (!raw.starting_at && !raw.starting_at_timestamp) throw new Error('Missing fixture date');
        const normalized = normaliseFixtureToMatchDoc(raw);
        if (!sideFor(normalized, teamId)) throw new Error('Missing fixture participant');
        normalized.match_info.season = { id: raw.season_id };
        normalized.match_info.league = { id: raw.league_id };
        const status = String(normalized.match_status?.state || normalized.match_status?.developer_name || '').toUpperCase();
        if (['POSTPONED', 'CANCELLED', 'CANCELED'].includes(status)) continue;
        const scores = raw.scores?.data || raw.scores;
        const hasScores = Array.isArray(scores) && ['home', 'away'].every(side => scores.some(score => String(score.participant_id) === String(normalized.teams?.[side]?.team_id) && score.description === 'CURRENT' && score.score?.goals != null));
        if (!hasScores) normalized.score = { home: null, away: null };
        normalized.context_events_available = Array.isArray(raw.events?.data || raw.events);
        fixtures.set(normalized.match_id, normalized);
      }
      if (!data.pagination.has_more) break;
      if (page === 10 || data.data.length === 0) throw new Error('Incomplete fixture pagination');
    }
  }
  const target = fixtures.get(Number(match.match_id));
  if (!target || !isFinishedMatch(target) || !hasFinalScore(target) || Number(target.score.home) !== Number(match.score.home) || Number(target.score.away) !== Number(match.score.away)) throw new Error('Target fixture does not match provider history');
  return { team_id: teamId, complete: true, source: 'Sportmonks season fixture history', fetched_at: new Date().toISOString(), matches: [...fixtures.values()] };
}

async function loadHistoricalContext(match, { get = (...args) => require('../utils/sportmonks').get(...args) } = {}) {
  const histories = await Promise.all(['home', 'away'].map(async side => {
    const teamId = match.teams?.[side]?.team_id;
    try {
      if (teamId == null) throw new Error('Missing team ID');
      return await fetchTeamHistory(match, teamId, get);
    } catch (error) {
      return { team_id: teamId, complete: false, matches: [], reason: 'Season history could not be verified; omit season totals and form claims.' };
    }
  }));
  return buildHistoricalContext({ match, histories });
}

module.exports = { buildHistoricalContext, hasCompleteEvents, loadHistoricalContext };