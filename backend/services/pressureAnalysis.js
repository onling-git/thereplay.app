// services/pressureAnalysis.js
// Deterministic backend summarization of Sportmonks Pressure Index minute-by-minute data.
// Run 1 (matchInterpretation.js) consumes only this summary, never the raw per-minute array.
//
// Pressure Index is relative (only one side can be positive in a given minute) and reflects
// match dynamics, not team quality - callers must not treat a higher share as "the better team"
// or "the deserving winner" without corroborating evidence.

const SUSTAINED_MIN_PRESSURE = 5; // pressure value below which a minute doesn't count as "dominant"
const SUSTAINED_MIN_MINUTES = 5; // minimum consecutive minutes to count as a sustained period
const SUSTAINED_GAP_TOLERANCE = 2; // allow small gaps (missing minutes) within one sustained period
const GOAL_WINDOW_MINUTES = 10; // lookback window used to judge pressure context around a goal

function round1(n) {
  return Math.round(n * 10) / 10;
}

function finalizePeriod(p) {
  return { team: p.team, start_minute: p.start, end_minute: p.end, duration: (p.end - p.start) + 1 };
}

/**
 * @param {Object} params
 * @param {Array} params.pressure - raw match.pressure array ({ participant_id, minute, pressure })
 * @param {Array} params.events - match.events array (used to locate goals)
 * @param {Number|String} params.homeTeamId
 * @param {Number|String} params.awayTeamId
 * @returns {Object} pressure_summary shape (see models/Match.js)
 */
function summarizePressure({ pressure, events = [], homeTeamId, awayTeamId }) {
  const raw = Array.isArray(pressure) ? pressure : [];
  if (!raw.length || homeTeamId == null || awayTeamId == null) {
    return { available: false };
  }

  // Collapse to one home/away pressure value per minute (multiple provider rows can share a minute).
  const byMinute = new Map();
  for (const p of raw) {
    const minute = Number(p.minute);
    if (!Number.isFinite(minute)) continue;
    const val = Number(p.pressure) || 0;
    const isHome = String(p.participant_id) === String(homeTeamId);
    const isAway = String(p.participant_id) === String(awayTeamId);
    if (!isHome && !isAway) continue;

    const entry = byMinute.get(minute) || { minute, home: 0, away: 0 };
    if (isHome) entry.home = Math.max(entry.home, val);
    else entry.away = Math.max(entry.away, val);
    byMinute.set(minute, entry);
  }

  const minutes = Array.from(byMinute.values()).sort((a, b) => a.minute - b.minute);
  if (!minutes.length) return { available: false };

  // 1) Overall pressure balance across the full match
  let homeTotal = 0, awayTotal = 0;
  for (const m of minutes) { homeTotal += m.home; awayTotal += m.away; }
  const grandTotal = homeTotal + awayTotal;
  const overall_balance = grandTotal > 0
    ? { home_pct: round1((homeTotal / grandTotal) * 100), away_pct: round1((awayTotal / grandTotal) * 100) }
    : { home_pct: 50, away_pct: 50 };

  // 2) Sustained pressure periods - consecutive minutes where one side clearly dominates
  const sustained_pressure_periods = [];
  let current = null;
  for (const m of minutes) {
    const dominant = m.home > m.away && m.home >= SUSTAINED_MIN_PRESSURE ? 'home'
      : m.away > m.home && m.away >= SUSTAINED_MIN_PRESSURE ? 'away'
      : null;

    if (dominant && current && current.team === dominant && (m.minute - current.end) <= SUSTAINED_GAP_TOLERANCE) {
      current.end = m.minute;
      continue;
    }
    if (current && (current.end - current.start) >= SUSTAINED_MIN_MINUTES) {
      sustained_pressure_periods.push(finalizePeriod(current));
    }
    current = dominant ? { team: dominant, start: m.minute, end: m.minute } : null;
  }
  if (current && (current.end - current.start) >= SUSTAINED_MIN_MINUTES) {
    sustained_pressure_periods.push(finalizePeriod(current));
  }

  // 3) Pressure in the minutes immediately preceding each goal
  const goalEvents = (events || []).filter(e => String(e.type || '').toLowerCase() === 'goal');
  const pressure_around_goals = goalEvents.map(g => {
    const minute = Number(g.minute);
    if (!Number.isFinite(minute)) return null;
    const window = minutes.filter(m => m.minute < minute && m.minute >= minute - GOAL_WINDOW_MINUTES);
    if (!window.length) return { minute, scoring_team: g.team || null, prior_pressure_balance: null };
    let homeW = 0, awayW = 0;
    for (const m of window) { homeW += m.home; awayW += m.away; }
    const windowTotal = homeW + awayW;
    return {
      minute,
      scoring_team: g.team || null,
      prior_pressure_balance: windowTotal > 0
        ? { home_pct: round1((homeW / windowTotal) * 100), away_pct: round1((awayW / windowTotal) * 100) }
        : null
    };
  }).filter(Boolean);

  // 4) Pressure after the final goal of the match (proxy for "holding on" vs "continuing to dominate")
  let pressure_after_leading = null;
  if (goalEvents.length) {
    const lastGoal = goalEvents[goalEvents.length - 1];
    const minute = Number(lastGoal.minute);
    if (Number.isFinite(minute)) {
      const after = minutes.filter(m => m.minute > minute);
      if (after.length) {
        let homeA = 0, awayA = 0;
        for (const m of after) { homeA += m.home; awayA += m.away; }
        const afterTotal = homeA + awayA;
        if (afterTotal > 0) {
          pressure_after_leading = {
            team_that_scored_last: lastGoal.team || null,
            balance_after_last_goal: { home_pct: round1((homeA / afterTotal) * 100), away_pct: round1((awayA / afterTotal) * 100) }
          };
        }
      }
    }
  }

  return {
    available: true,
    overall_balance,
    sustained_pressure_periods,
    pressure_around_goals,
    pressure_after_leading,
    computed_at: new Date()
  };
}

module.exports = { summarizePressure };
