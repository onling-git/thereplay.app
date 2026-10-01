// One-off: ensure match 19729157 has odds + pressure_summary data in staging DB (real if
// available, fabricated fallback otherwise) so the report can be manually regenerated with
// the new Run 1 market/pressure research populated. Delete after use.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.staging'), override: true });

const { connectDB, closeDB } = require('../db/connect');
const Match = require('../models/Match');
const { fetchAndSummarizeOdds } = require('../services/sportmonksOdds');
const { summarizePressure } = require('../services/pressureAnalysis');

const MATCH_ID = 19729157;

function fabricatedOdds(match) {
  // A clear, illustrative "underdog upset" scenario: home side strongly favoured, away side wins.
  return {
    available: true,
    market_id: 1,
    market_name: 'Fulltime Result',
    bookmakers_used: 8,
    confidence: 'high',
    probabilities: { home: 0.62, draw: 0.23, away: 0.15 },
    favourite: 'home',
    favourite_strength: 'strong',
    fetched_at: new Date()
  };
}

function fabricatedPressureSummary(match) {
  const homeId = match.home_team_id ?? match.teams?.home?.team_id;
  const awayId = match.away_team_id ?? match.teams?.away?.team_id;
  const goalEvents = (match.events || []).filter(e => String(e.type || '').toLowerCase() === 'goal');

  // Build a plausible raw pressure array: home dominates most of the match, away scores late.
  const pressure = [];
  for (let m = 1; m <= 90; m++) {
    const awaySurge = m >= 70 && m <= 85;
    pressure.push({ participant_id: homeId, minute: m, pressure: awaySurge ? 2 : 12 });
    pressure.push({ participant_id: awayId, minute: m, pressure: awaySurge ? 22 : 3 });
  }

  return summarizePressure({ pressure, events: match.events || [], homeTeamId: homeId, awayTeamId: awayId });
}

async function main() {
  await connectDB(process.env.DBURI);

  const match = await Match.findOne({ match_id: MATCH_ID }).lean();
  if (!match) {
    console.log(`Match ${MATCH_ID} not found in staging DB.`);
    return;
  }

  console.log(`Match ${MATCH_ID}: ${match.home_team || match.teams?.home?.team_name} vs ${match.away_team || match.teams?.away?.team_name}`);
  console.log('Existing odds.available:', match.odds?.available, '| pressure_summary.available:', match.pressure_summary?.available);

  const setPayload = {};

  // Try real odds first
  let odds = null;
  try {
    odds = await fetchAndSummarizeOdds(MATCH_ID);
  } catch (e) {
    console.warn('Real odds fetch failed:', e?.message || e);
  }
  if (odds && odds.available) {
    console.log('Using REAL odds data.');
    setPayload.odds = odds;
  } else {
    console.log('No real odds available - using fabricated odds.');
    setPayload.odds = fabricatedOdds(match);
  }

  // Pressure: only fabricate if not already present (real pressure requires re-syncing via
  // matchSyncController, which is a heavier operation and was already exercised in the previous test)
  if (match.pressure_summary?.available) {
    console.log('Real pressure_summary already present - leaving as-is.');
  } else {
    console.log('No real pressure_summary available - using fabricated pressure_summary.');
    setPayload.pressure_summary = fabricatedPressureSummary(match);
  }

  await Match.findOneAndUpdate({ match_id: MATCH_ID }, { $set: setPayload });

  const updated = await Match.findOne({ match_id: MATCH_ID }).lean();
  console.log('\nFinal odds:', JSON.stringify(updated.odds, null, 2));
  console.log('\nFinal pressure_summary:', JSON.stringify(updated.pressure_summary, null, 2));
}

main()
  .catch(e => console.error('Failed:', e))
  .finally(() => closeDB());
