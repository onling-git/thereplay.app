// Scan recent reports for team-attribution/winner inversion using the new validator.
// Usage: node scan_reports_for_inversions.js [.env file] [sinceDate]
require('dotenv').config({ path: process.argv[2] || '.env.production', override: true });
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Report = require('./models/Report');
const { validateTeamAttribution } = require('./services/matchReportWriter');

const since = new Date(process.argv[3] || '2026-09-15T00:00:00Z');

function buildFacts(match) {
  const homeName = match.home_team || match.teams?.home?.team_name;
  const awayName = match.away_team || match.teams?.away?.team_name;
  const homeId = match.teams?.home?.team_id || match.home_team_id;
  const awayId = match.teams?.away?.team_id || match.away_team_id;
  const score = match.score || {};
  const scoringEvents = (match.events || []).filter(e => {
    const t = String(e.type || '').toLowerCase().replace(/[\s-]/g, '_');
    return ['goal', 'owngoal', 'own_goal', 'penalty', 'penalty_goal', 'penalty_shootout_goal'].includes(t) && e.rescinded !== true;
  }).map(e => {
    const type = String(e.type || '').toLowerCase().replace(/[\s-]/g, '_');
    const teamValue = e.team || e.team_name || e.participant_id;
    const normalisedTeam = String(teamValue || '').toLowerCase().trim();
    let side = null;
    if (String(teamValue) === String(homeId) || normalisedTeam === String(homeName || '').toLowerCase()) side = 'home';
    if (String(teamValue) === String(awayId) || normalisedTeam === String(awayName || '').toLowerCase()) side = 'away';
    if (!side && (normalisedTeam === 'home' || normalisedTeam === '1')) side = 'home';
    if (!side && (normalisedTeam === 'away' || normalisedTeam === '2')) side = 'away';
    if (!side) return null;
    const scoringSide = type === 'owngoal' || type === 'own_goal' ? (side === 'home' ? 'away' : 'home') : side;
    return { minute: Number(e.minute), scorer: String(e.player_name || e.player || '').trim(), side: scoringSide, type };
  }).filter(e => e && e.scorer);
  return {
    final_score: { home: Number(score.home), away: Number(score.away) },
    teams: { home: homeName || null, away: awayName || null },
    scoring_events: scoringEvents
  };
}

async function main() {
  await mongoose.connect(process.env.DBURI);
  const matches = await Match.find({ date: { $gte: since }, 'score.home': { $exists: true } })
    .select('match_id date score teams home_team away_team home_team_id away_team_id events')
    .lean();
  console.log(`Matches since ${since.toISOString().slice(0, 10)}: ${matches.length}`);
  const matchById = new Map(matches.map(m => [m.match_id, m]));

  const reports = await Report.find({ match_id: { $in: [...matchById.keys()] } }).lean();
  console.log(`Reports for those matches: ${reports.length}\n`);

  let flagged = 0;
  for (const r of reports) {
    const match = matchById.get(r.match_id);
    if (!match) continue;
    const generated = r.generated || {};
    const reportContent = {
      headline: generated.headline || r.headline || '',
      summary_paragraphs: generated.summary_paragraphs || r.summary_paragraphs || [],
      key_moments: generated.key_moments || r.key_moments || [],
      commentary: generated.commentary || r.commentary || []
    };
    if (!reportContent.headline && !reportContent.summary_paragraphs.length) continue;
    const issues = validateTeamAttribution(reportContent, buildFacts(match));
    if (issues.length) {
      flagged++;
      console.log(`⚠️  match ${r.match_id} / ${r.team_slug} (${match.teams?.home?.team_name} ${match.score?.home}-${match.score?.away} ${match.teams?.away?.team_name}, ${String(match.date).slice(0, 10)})`);
      console.log(`    headline: ${reportContent.headline}`);
      issues.forEach(i => console.log(`    - ${i}`));
      console.log('');
    }
  }
  console.log(`Flagged ${flagged} of ${reports.length} reports.`);
  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
