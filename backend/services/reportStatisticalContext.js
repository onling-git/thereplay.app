function numericValue(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const parsed = Number(typeof value === 'string' ? value.replace(/%$/, '').trim() : value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

const METRICS = {
  possession_pct: { id: 45 },
  shots_total: { id: 42 },
  shots_on_target: { id: 86 },
  shots_off_target: { id: 41 },
  shots_blocked: { id: 58 },
  shots_inside_box: { id: 49 },
  big_chances_created: { id: 580 },
  big_chances_missed: { id: 581 },
  passes: { id: 80 },
  successful_passes: { id: 81 },
  overall_pass_accuracy_pct: { id: 82 },
  key_passes: { id: 117 },
  saves: { id: 57 },
  final_third_pass_accuracy_pct: { name: /^(?:final third pass(?:ing)? (?:accuracy|success percentage)|successful final third passes percentage)$/i },
  turnovers_conceded: { name: /^(?:turnovers(?: conceded)?|turn overs(?: conceded)?)$/i },
  possession_lost: { name: /^(?:possession lost|possessions lost|ball losses)$/i },
  dispossessed: { name: /^dispossessed$/i },
  expected_goals: { name: /^(?:expected goals(?: \(xg\))?|xg)$/i, id: 1620 }
};

function buildStatisticalContext(match, xg = { available: false, home: null, away: null }) {
  const context = {
    version: 'report-statistics-2026-10-01.1',
    source_match_id: match.match_id,
    xg_status: xg.reason || (xg.available ? 'available' : 'not_supplied'),
    teams: [],
    use_rules: [
      'Use these provider statistics even when Run 1 omitted them. Select comparisons that explain chance creation, finishing or defensive work, not a list of every number.',
      'Null means unavailable, not zero. Overall passing accuracy is not final-third accuracy.',
      'Turnovers, possession lost and dispossessions are distinct provider metrics; do not relabel one as another.',
      'xG describes estimated chance quality, not proof of luck, deserved victory or the cause of missed chances.',
      'Big chances missed, shots on target and goalkeeper saves provide different evidence; do not assume every shot was a clear chance.'
    ]
  };
  for (const side of ['home', 'away']) {
    const rows = (Array.isArray(match.statistics?.[side]) ? match.statistics[side] : []).map(stat => ({
      type_id: stat.type_id ?? null,
      name: typeof stat.type === 'string' ? stat.type : stat.type?.name || stat.name || '',
      value: numericValue(stat.value ?? stat.data?.value)
    })).filter(stat => stat.value !== null);
    const metrics = {};
    for (const [name, definition] of Object.entries(METRICS)) {
      const row = rows.find(stat => (definition.id != null && Number(stat.type_id) === definition.id) || (definition.name && definition.name.test(stat.name.replace(/[-_]/g, ' '))));
      metrics[name] = row?.value ?? null;
    }
    if (numericValue(xg[side]) !== null) metrics.expected_goals = numericValue(xg[side]);
    metrics.shots_on_target_pct = metrics.shots_total > 0 && metrics.shots_on_target !== null && metrics.shots_on_target <= metrics.shots_total
      ? Math.round(metrics.shots_on_target / metrics.shots_total * 1000) / 10 : null;
    context.teams.push({ side, team_id: match.teams?.[side]?.team_id ?? null, team_name: match.teams?.[side]?.team_name || match[`${side}_team`] || null, metrics, provider_statistics: rows });
  }
  return context;
}

async function loadXgContext(match, { get = (...args) => require('../utils/sportmonks').get(...args) } = {}) {
  const result = { available: false, home: null, away: null, reason: 'not_supplied' };
  try {
    const response = await get(`fixtures/${match.match_id}`, { include: 'xGFixture.type' }, { timeout: 10000 });
    const fixture = response.data?.data;
    if (String(fixture?.id) !== String(match.match_id)) return result;
    const rows = fixture.xgfixture?.data || fixture.xgfixture || fixture.xGFixture?.data || fixture.xGFixture || [];
    if (!Array.isArray(rows)) return result;
    for (const side of ['home', 'away']) {
      const row = rows.find(item => {
        const teamId = item.team_id ?? item.participant_id;
        const name = String(item.type?.name || item.type?.code || '').replace(/[-_]/g, ' ');
        return teamId != null && String(teamId) === String(match.teams?.[side]?.team_id) && /^(?:expected goals(?: \(xg\))?|xg)$/i.test(name);
      });
      result[side] = numericValue(row?.data?.value ?? row?.value);
    }
    result.available = result.home !== null || result.away !== null;
    if (result.available) result.reason = 'available';
  } catch (error) {
    result.reason = error.response?.status === 403 ? 'subscription_unavailable' : 'temporarily_unavailable';
  }
  return result;
}

module.exports = { buildStatisticalContext, loadXgContext };