// Diagnose match 19722154: verify score, goal events, side assignment, and stored report
// Usage: node check_match_19722154.js [.env file path]   (default .env.local)
const envPath = process.argv[2] || '.env.local';
require('dotenv').config({ path: envPath, override: true });
console.log('Using env file:', envPath);
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Report = require('./models/Report');

async function main() {
  const uri = process.env.DBURI || process.env.MONGODB_URI;
  if (!uri) throw new Error('No DBURI in env');
  await mongoose.connect(uri);
  console.log('Connected to:', uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'));

  const match = await Match.findOne({ match_id: 19722154 }).lean();
  if (!match) {
    console.log('Match 19722154 NOT FOUND');
    process.exit(1);
  }

  console.log('\n=== MATCH ===');
  console.log('home_team:', match.home_team, '| away_team:', match.away_team);
  console.log('teams.home:', match.teams?.home?.team_name, '(id:', match.teams?.home?.team_id + ')');
  console.log('teams.away:', match.teams?.away?.team_name, '(id:', match.teams?.away?.team_id + ')');
  console.log('score:', JSON.stringify(match.score));
  console.log('status:', match.match_status?.state || match.status);
  console.log('date:', match.date);
  console.log('venue:', match.match_info?.venue?.name || match.venue?.name);

  console.log('\n=== GOAL-RELATED EVENTS (raw) ===');
  const goalish = (match.events || []).filter(e => {
    const t = String(e.type || '').toLowerCase().replace(/[\s-]/g, '_');
    return ['goal', 'owngoal', 'own_goal', 'penalty', 'penalty_goal', 'penalty_shootout_goal'].includes(t);
  });
  for (const e of goalish) {
    console.log(JSON.stringify({
      type: e.type,
      minute: e.minute,
      extra_minute: e.extra_minute,
      player_name: e.player_name,
      player: e.player,
      team: e.team,
      team_name: e.team_name,
      participant_id: e.participant_id,
      result: e.result,
      rescinded: e.rescinded
    }));
  }
  console.log('Total goal-type events:', goalish.length);

  // Re-run the pipeline's side-assignment logic to see what authoritative facts would be produced
  console.log('\n=== AUTHORITATIVE FACTS (recomputed via pipeline logic) ===');
  const homeId = match.teams?.home?.team_id || match.home_team_id;
  const awayId = match.teams?.away?.team_id || match.away_team_id;
  const homeName = match.home_team || match.teams?.home?.team_name;
  const awayName = match.away_team || match.teams?.away?.team_name;

  const scoringEvents = (match.events || []).filter(e => {
    const t = String(e.type || '').toLowerCase().replace(/[\s-]/g, '_');
    return ['goal', 'owngoal', 'own_goal', 'penalty', 'penalty_goal', 'penalty_shootout_goal'].includes(t) && e.rescinded !== true;
  }).map((e, i) => {
    const type = String(e.type || '').toLowerCase().replace(/[\s-]/g, '_');
    const player = e.player_name || e.player;
    const minute = Number(e.minute);
    const teamValue = e.team || e.team_name || e.participant_id;
    const normalisedTeam = String(teamValue || '').toLowerCase().trim();
    let side = null;
    if (String(teamValue) === String(homeId) || normalisedTeam === String(homeName || '').toLowerCase()) side = 'home';
    if (String(teamValue) === String(awayId) || normalisedTeam === String(awayName || '').toLowerCase()) side = 'away';
    if (!side && (normalisedTeam === 'home' || normalisedTeam === '1')) side = 'home';
    if (!side && (normalisedTeam === 'away' || normalisedTeam === '2')) side = 'away';
    if (!player || !Number.isFinite(minute) || !side) {
      return { excluded: true, reason: `missing player/minute/side (teamValue=${teamValue})` };
    }
    return {
      minute,
      scorer: String(player).trim(),
      side: type === 'owngoal' || type === 'own_goal' ? (side === 'home' ? 'away' : 'home') : side,
      type,
      result: e.result || null
    };
  });
  console.log(JSON.stringify(scoringEvents, null, 2));

  console.log('\n=== STORED REPORTS FOR THIS MATCH ===');
  const reports = await Report.find({ match_id: 19722154 }).lean();
  for (const r of reports) {
    console.log('---');
    console.log('team_slug:', r.team_slug, '| team_focus:', r.team_focus);
    console.log('pipeline_version:', r.generated?.meta?.pipeline_version || r.meta?.pipeline_version);
    console.log('generated_by:', r.generated?.meta?.generated_by || r.meta?.generated_by);
    console.log('generated_at:', r.generated?.meta?.generated_at || r.updatedAt || r.created_at);
    console.log('headline:', r.generated?.headline || r.headline);
    const paras = r.generated?.summary_paragraphs || r.summary_paragraphs || [];
    console.log('paragraphs:');
    paras.forEach((p, i) => console.log(`  [${i}] ${p}`));
    const km = r.generated?.key_moments || r.key_moments || [];
    console.log('key_moments:');
    km.forEach(k => console.log('  -', k));
  }
  if (!reports.length) console.log('No reports found for match 19722154');

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });
