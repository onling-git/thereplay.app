function number(value) {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function detail(row, typeId) {
  return number(row.details?.find(item => Number(item.type_id) === typeId)?.value);
}

function scheduleTotal(stages, row, match) {
  if (!Array.isArray(stages)) return null;
  const stage = stages.find(item => String(item.id) === String(row.stage_id) && String(item.season_id) === String(match.match_info?.season?.id) && Number(item.type_id) === 223);
  if (!stage || !Array.isArray(stage.rounds) || !stage.rounds.length) return null;
  const fixtures = new Map();
  for (const round of stage.rounds) {
    if (!Array.isArray(round.fixtures)) return null;
    for (const fixture of round.fixtures) {
      if (!fixture.id || fixture.placeholder || String(fixture.season_id) !== String(stage.season_id) || String(fixture.stage_id) !== String(stage.id)) return null;
      if (!fixture.participants?.some(team => String(team.id) === String(row.participant_id))) return null;
      if (Number(fixture.state_id) === 7) return null;
      fixtures.set(String(fixture.id), fixture);
    }
  }
  return fixtures.has(String(match.match_id)) && fixtures.size >= detail(row, 129) ? fixtures.size : null;
}

function buildLeagueContext({ match, round, table, corrections = [], schedules = {}, now = Date.now() }) {
  const unavailable = { available: false, reason: 'No verified completed-round table for this fixture.' };
  const seasonId = match.match_info?.season?.id;
  const leagueId = match.match_info?.league?.id;
  const roundId = match.match_info?.round?.id;
  const matchDate = new Date(match.date || match.match_info?.starting_at).toISOString().slice(0, 10);
  if (!roundId || !round?.finished || String(round.id) !== String(roundId) || String(round.season_id) !== String(seasonId) || String(round.league_id) !== String(leagueId)) return unavailable;
  if (!round.ending_at || !round.starting_at || round.ending_at.slice(0, 10) > new Date(now).toISOString().slice(0, 10) || matchDate < round.starting_at.slice(0, 10) || matchDate > round.ending_at.slice(0, 10)) return unavailable;
  if (!round.fixtures?.some(fixture => String(fixture.id) === String(match.match_id))) return unavailable;
  if (!Array.isArray(table) || table.length < 2 || table.some(row => String(row.round_id) !== String(roundId) || String(row.season_id) !== String(seasonId) || String(row.league_id) !== String(leagueId) || String(row.stage_id) !== String(round.stage_id))) return unavailable;
  const sorted = [...table].sort((first, second) => Number(first.position) - Number(second.position));
  if (new Set(sorted.map(row => row.participant_id)).size !== sorted.length || sorted.some((row, index) => Number(row.position) !== index + 1 || number(row.points) === null)) return unavailable;
  const ruleName = row => String(row.rule?.type?.code || row.rule?.type?.name || '').toLowerCase();
  const relegation = sorted.filter(row => /relegation/.test(ruleName(row)));
  const relegationStart = relegation[0]?.position;
  const contiguousRelegation = relegation.length > 0 && relegation.every((row, index) => Number(row.position) === Number(relegationStart) + index) && Number(relegation.at(-1).position) === sorted.length;
  const safeRow = contiguousRelegation ? sorted.find(row => Number(row.position) === Number(relegationStart) - 1) : null;
  const playoffRows = sorted.filter(row => /promotion.*play.?off/i.test(ruleName(row)));
  const playoffBoundary = playoffRows.at(-1);
  const context = {
    available: true,
    source: 'Sportmonks official round standings',
    season_id: seasonId, competition_id: leagueId, round_id: roundId,
    round_name: round.name, as_of_date: round.ending_at.slice(0, 10), scope: 'end_of_round',
    use_rules: [
      'These are official standings at the end of the named round, not necessarily at this match final whistle. State that timing explicitly; do not claim the result alone caused a position change.',
      'Official points and rankings already account for sanctions. Never replace them with wins times three plus draws.',
      'Point gaps are gaps to the current boundary, not points that guarantee safety, promotion or qualification. Equal points may still leave a club below the boundary on tie-breakers.',
      'Games remaining refer to this club in the named regular-season stage, not calendar weeks or rounds, and do not include future play-offs.',
      'Sanctions listed as current provider records may not carry an effective date; do not infer when they were imposed or subtract them again.'
    ],
    teams: []
  };
  for (const side of ['home', 'away']) {
    const teamId = match.teams?.[side]?.team_id;
    const row = sorted.find(item => String(item.participant_id) === String(teamId));
    if (!row) continue;
    const played = detail(row, 129);
    if (!Number.isInteger(played) || played < 1) continue;
    const historicalTeam = match.report_context?.teams?.find(team => String(team.team_id) === String(teamId));
    if (historicalTeam?.coverage?.complete && historicalTeam.after_match.played !== played) continue;
    const total = scheduleTotal(schedules[teamId], row, match);
    const points = Number(row.points);
    const rowContext = {
      team_id: teamId, team_name: match.teams[side].team_name, position: Number(row.position), teams_in_table: sorted.length,
      official_points: points, played, bottom: Number(row.position) === sorted.length,
      regular_season_games_remaining: total === null ? null : total - played,
      current_provider_sanctions: (Array.isArray(corrections) ? corrections : []).filter(item => item.active === true && String(item.participant_id) === String(teamId) && String(item.season_id) === String(seasonId) && String(item.stage_id) === String(row.stage_id)).map(item => ({ id: item.id, operation: item.calc_type, value: number(item.value), effective_date: null })),
      safety: safeRow ? {
        in_relegation_zone: Number(row.position) >= Number(relegationStart),
        safe_position: Number(safeRow.position), boundary_team_id: safeRow.participant_id, boundary_points: Number(safeRow.points),
        points_behind_safety: Number(row.position) >= Number(relegationStart) ? Math.max(0, Number(safeRow.points) - points) : null,
        points_above_relegation_zone: Number(row.position) < Number(relegationStart) ? Math.max(0, points - Number(relegation[0].points)) : null,
        boundary_team_played: detail(safeRow, 129)
      } : null,
      promotion_playoff_boundary: playoffBoundary ? { position: Number(playoffBoundary.position), official_points: Number(playoffBoundary.points), team_played: detail(playoffBoundary, 129), points_behind: Number(row.position) > Number(playoffBoundary.position) ? Math.max(0, Number(playoffBoundary.points) - points) : null } : null
    };
    context.teams.push(rowContext);
  }
  return context.teams.length ? context : unavailable;
}

async function loadLeagueContext(match, { isCup = false, get = (...args) => require('../utils/sportmonks').get(...args), now = Date.now() } = {}) {
  const unavailable = { available: false, reason: 'League context unavailable; omit table implications.' };
  const roundId = match.match_info?.round?.id;
  const seasonId = match.match_info?.season?.id;
  if (isCup || !roundId || !seasonId) return unavailable;
  try {
    const round = (await get(`rounds/${roundId}`, { include: 'fixtures' }, { timeout: 15000 })).data?.data;
    if (!round?.finished) return unavailable;
    const table = (await get(`standings/rounds/${roundId}`, { include: 'details.type;rule.type' }, { timeout: 15000 })).data?.data;
    const optional = async (path) => { try { return (await get(path, {}, { timeout: 15000 })).data?.data; } catch (error) { return null; } };
    const corrections = await optional(`standings/corrections/seasons/${seasonId}`);
    const schedules = {};
    for (const side of ['home', 'away']) {
      const teamId = match.teams?.[side]?.team_id;
      if (teamId != null) schedules[teamId] = await optional(`schedules/seasons/${seasonId}/teams/${teamId}`);
    }
    return buildLeagueContext({ match, round, table, corrections, schedules, now });
  } catch (error) {
    return unavailable;
  }
}

module.exports = { buildLeagueContext, loadLeagueContext };