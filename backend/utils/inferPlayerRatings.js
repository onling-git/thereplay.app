// utils/inferPlayerRatings.js
// Heuristic-based inference of player ratings from match events.
// Export: inferRatings(match) => { ratings: [...], mom: { player, player_id, rating, reason } }

function normalizeName(n) {
  return String(n || '').trim();
}

// Map event types/subtypes to simple contributions
const WEIGHTS = {
  goal: 3.0,
  assist: 2.0,
  shot_on_target: 0.5,
  shot: 0.2,
  yellowcard: -0.5,
  redcard: -3.0,
  own_goal: -2.0
};

function inferRatingsFromEvents(match) {
  const events = match.events || [];
  const lineupHome = (match.lineup && match.lineup.home) || [];
  const lineupAway = (match.lineup && match.lineup.away) || [];
  const homeName = match.home_team || null;
  const awayName = match.away_team || null;

  const players = new Map();

  // Helper to ensure a player record
  function ensurePlayer(name, team) {
    const key = normalizeName(name);
    if (!players.has(key)) {
      players.set(key, { player: name, player_id: null, team: team || null, raw: 0, goals: 0, assists: 0 });
    }
    return players.get(key);
  }

  // collect from lineups if available (to capture player_id)
  function mapLineup(list, teamName) {
    for (const p of list || []) {
      const name = p.name || p.player || p.player_name || '';
      const key = normalizeName(name);
      if (!key) continue;
      if (!players.has(key)) players.set(key, { player: name, player_id: p.player_id || p.player?.id || null, team: teamName || null, raw: 0, goals: 0, assists: 0 });
      const rec = players.get(key);
      if (!rec.player_id && (p.player_id || (p.player && p.player.id))) rec.player_id = p.player_id || (p.player && p.player.id) || null;
      if (!rec.team && teamName) rec.team = teamName;
    }
  }

  mapLineup(lineupHome, homeName);
  mapLineup(lineupAway, awayName);

  for (const e of events || []) {
    const type = String(e.type || '').toLowerCase();
    const subtype = String(e.subtype || '').toLowerCase();
    const playerName = normalizeName(e.player || e.related_player || '');
    const team = e.team || null;

    if (!playerName) continue;
  const rec = ensurePlayer(playerName, team || null);

    // Detect goal events: type or addition or result may indicate a goal
    const addition = String(e.addition || '').toLowerCase();
    const info = String(e.info || '').toLowerCase();
    const result = String(e.result || '').toLowerCase();

    const isGoal = type === 'goal' || addition.includes('goal') || result.match(/\d-\d/);
    if (isGoal) {
      rec.raw += WEIGHTS.goal;
      rec.goals = (rec.goals || 0) + 1;

      // If there's a related_player, treat that as an assist where plausible
      if (e.related_player) {
        const assisterName = normalizeName(e.related_player);
        if (assisterName) {
          const assRec = ensurePlayer(assisterName, null);
          assRec.raw += WEIGHTS.assist;
          assRec.assists = (assRec.assists || 0) + 1;
        }
      }
    }

    // Own goals
    if (subtype === 'own goal' || info.includes('own goal')) {
      rec.raw += WEIGHTS.own_goal;
    }

    // Assists - sometimes subtype or addition contains 'assist' as well
    if (addition.includes('assist') || info.includes('assist')) {
      rec.raw += WEIGHTS.assist;
      rec.assists = (rec.assists || 0) + 1;
    }

    // Cards
    if (type === 'yellowcard') rec.raw += WEIGHTS.yellowcard;
    if (type === 'redcard') rec.raw += WEIGHTS.redcard;

    // Shots / shots on target - best-effort from info/result
    if (String(e.info || '').toLowerCase().includes('shot on target')) rec.raw += WEIGHTS.shot_on_target;
    else if (String(e.info || '').toLowerCase().includes('shot')) rec.raw += WEIGHTS.shot;
  }

  // Turn raw scores into 1-10 ratings
  const all = Array.from(players.values());
  if (!all.length) return { ratings: [], mom: null };

  // compute min/max raw for scaling
  const rawVals = all.map(a => a.raw);
  const maxRaw = Math.max(...rawVals);
  const minRaw = Math.min(...rawVals);

  function mapToRating(raw) {
    // if all raws equal (e.g., zeros), assign a neutral 6.0
    if (maxRaw === minRaw) return 6.0;
    const norm = (raw - minRaw) / (maxRaw - minRaw); // 0..1
    return Number((1 + norm * 9).toFixed(1));
  }

  const ratings = all.map(a => {
    const rating = mapToRating(a.raw);
    return {
      player: a.player,
      player_id: a.player_id || null,
      team: a.team || null,
      rating,
      inferred: true,
      source: 'events-heuristic-v1',
      calculated_at: new Date()
    };
  }).sort((x, y) => (y.rating || 0) - (x.rating || 0));

  const mom = ratings[0] || null;

  return { ratings, mom };
}

// Ensure lineup players are present with at least a baseline rating
function ensureLineupBaselines(ratings, lineupHome, lineupAway, homeName, awayName) {
  const byName = new Map(ratings.map(r => [String(r.player || '').toLowerCase(), r]));
  const baseline = 6.0;

  function addIfMissing(p, teamName) {
    const name = normalizeName(p.name || p.player || p.player_name || '');
    if (!name) return;
    const key = name.toLowerCase();
    if (!byName.has(key)) {
      const rec = {
        player: name,
        player_id: p.player_id || (p.player && p.player.id) || null,
        team: teamName || null,
        rating: baseline,
        inferred: true,
        source: 'lineup-baseline',
        calculated_at: new Date()
      };
      byName.set(key, rec);
    } else {
      // ensure team is set if known
      const existing = byName.get(key);
      if (!existing.team && teamName) existing.team = teamName;
    }
  }

  for (const p of lineupHome || []) addIfMissing(p, homeName);
  for (const p of lineupAway || []) addIfMissing(p, awayName);

  // After ensuring lineup players are present, if we still have fewer than 22
  // rated players, pad with neutral placeholders so matches always have a
  // full 22-player list for downstream consumers.
  const outList = Array.from(byName.values());

  const TARGET_PLAYERS = 22;
  if (outList.length < TARGET_PLAYERS) {
    const need = TARGET_PLAYERS - outList.length;
    // Distribute placeholders between home and away where possible.
    const placeholders = [];
    let hIndex = 1;
    let aIndex = 1;
    for (let i = 0; i < need; i++) {
      const assignHome = (i % 2 === 0); // alternate home/away
      const teamName = assignHome ? homeName : awayName;
      const nameLabelBase = teamName ? teamName : (assignHome ? 'Home' : 'Away');
      const idx = assignHome ? hIndex++ : aIndex++;
      const pname = `Unknown Player ${idx} (${nameLabelBase})`;
      // ensure we don't collide with existing names
      const key = String(pname).toLowerCase();
      if (byName.has(key)) continue;
      const rec = {
        player: pname,
        player_id: null,
        team: teamName || null,
        rating: baseline,
        inferred: true,
        source: 'lineup-padding',
        calculated_at: new Date()
      };
      byName.set(key, rec);
      placeholders.push(rec);
    }
    // merge placeholders into the outList
    outList.push(...placeholders);
  }

  const out = outList.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  return out;
}

module.exports = { inferRatingsFromEvents, ensureLineupBaselines };
