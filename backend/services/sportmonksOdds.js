// services/sportmonksOdds.js
// Fetches Sportmonks pre-match odds for the Fulltime Result market and reduces the
// multi-bookmaker raw response into a single, backend-computed "market expectation"
// summary. No raw per-bookmaker rows are ever persisted or passed to the AI - only the
// consensus (median, de-vigged) outcome. This avoids treating any single bookmaker as
// ground truth and avoids sending large raw odds payloads into Run 1.

const { get } = require('../utils/sportmonks');

// Sportmonks market_id 1 is the 1X2 win market (labelled "Fulltime Result" or
// "Match Winner" depending on bookmaker/context - the id is the stable identifier).
const FULLTIME_RESULT_MARKET_ID = 1;

const MIN_BOOKMAKERS_HIGH_CONFIDENCE = 5;
const MIN_BOOKMAKERS_MEDIUM_CONFIDENCE = 3;

function round1(n) {
  return Math.round(n * 10) / 10;
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Bookmakers label the 1X2 outcomes differently ("1"/"X"/"2" vs "Home"/"Draw"/"Away").
function classifyOutcomeLabel(label) {
  const l = String(label || '').trim().toLowerCase();
  if (l === '1' || l === 'home') return 'home';
  if (l === 'x' || l === 'draw') return 'draw';
  if (l === '2' || l === 'away') return 'away';
  return null;
}

/**
 * Fetch and summarize pre-match odds for a fixture.
 * @param {Number} matchId - Sportmonks fixture id
 * @returns {Promise<Object>} odds summary (see models/Match.js `odds` field), or { available: false }
 */
async function fetchAndSummarizeOdds(matchId) {
  let rows = [];
  try {
    const res = await get(`odds/pre-match/fixtures/${matchId}/markets/${FULLTIME_RESULT_MARKET_ID}`);
    rows = res?.data?.data || res?.data || [];
  } catch (e) {
    console.warn('[sportmonksOdds] fetch failed for match', matchId, e?.response?.status || e.message || e);
    return { available: false };
  }

  if (!Array.isArray(rows) || !rows.length) return { available: false };

  // Group by bookmaker so each bookmaker contributes one de-vigged 3-way probability set.
  const byBookmaker = new Map();
  for (const row of rows) {
    const outcome = classifyOutcomeLabel(row.label || row.name);
    if (!outcome) continue;
    const prob = parseFloat(String(row.probability || '').replace('%', ''));
    if (!Number.isFinite(prob)) continue;
    const entry = byBookmaker.get(row.bookmaker_id) || {};
    entry[outcome] = prob;
    byBookmaker.set(row.bookmaker_id, entry);
  }

  const devigged = { home: [], draw: [], away: [] };
  for (const entry of byBookmaker.values()) {
    if (entry.home == null || entry.draw == null || entry.away == null) continue; // incomplete row, skip
    const sum = entry.home + entry.draw + entry.away;
    if (sum <= 0) continue;
    // Normalize away the bookmaker's overround so probabilities sum to 100%.
    devigged.home.push((entry.home / sum) * 100);
    devigged.draw.push((entry.draw / sum) * 100);
    devigged.away.push((entry.away / sum) * 100);
  }

  const bookmakersUsed = devigged.home.length;
  if (!bookmakersUsed) return { available: false };

  // Median across bookmakers, then re-normalize (no single bookmaker is treated as "truth").
  const medianHome = median(devigged.home);
  const medianDraw = median(devigged.draw);
  const medianAway = median(devigged.away);
  const medianSum = medianHome + medianDraw + medianAway;

  const probabilities = {
    home: round1((medianHome / medianSum) * 100),
    draw: round1((medianDraw / medianSum) * 100),
    away: round1((medianAway / medianSum) * 100)
  };

  const [favouriteSide, favouriteProb] = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0];

  let favouriteStrength = 'toss_up';
  if (favouriteSide !== 'draw') {
    if (favouriteProb >= 60) favouriteStrength = 'strong';
    else if (favouriteProb >= 45) favouriteStrength = 'slight';
  }

  const confidence = bookmakersUsed >= MIN_BOOKMAKERS_HIGH_CONFIDENCE ? 'high'
    : bookmakersUsed >= MIN_BOOKMAKERS_MEDIUM_CONFIDENCE ? 'medium'
    : 'low';

  return {
    available: true,
    market_id: FULLTIME_RESULT_MARKET_ID,
    market_name: 'Fulltime Result',
    bookmakers_used: bookmakersUsed,
    confidence,
    probabilities: {
      home: round3(probabilities.home / 100),
      draw: round3(probabilities.draw / 100),
      away: round3(probabilities.away / 100)
    },
    favourite: favouriteSide === 'draw' ? 'none' : favouriteSide,
    favourite_strength: favouriteSide === 'draw' ? 'toss_up' : favouriteStrength,
    fetched_at: new Date()
  };
}

module.exports = { fetchAndSummarizeOdds };
