// controllers/matchSyncControllerOptimized.js - Optimized to prevent event loop blocking
const axios = require('axios');
const { get: smGet } = require('../utils/sportmonks');
const Match = require('../models/Match');
const Team = require('../models/Team');

// Utility: slugify team names (matches your Match schema)
const slugify = s =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

// Event loop yielding helper to prevent blocking
function yieldEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

// OPTIMIZED: Fetch match stats with timeout and circuit breaker
async function fetchMatchStats(matchId, opts = {}) {
  // Aggressive timeout to prevent blocking node-cron
  const TIMEOUT_MS = opts.timeout || 8_000;
  
  const includesToTry = opts.forFinished ? [
    'lineups.details.type;events;participants;periods',
    'lineups.details.type',
    'lineups',
    'events;participants;periods',
    'state',
    'time'
  ] : [
    'state',
    'time', 
    'lineups',
    'events;participants;periods'
  ];

  let lastErr = null;
  for (const inc of includesToTry) {
    try {
      // Race against timeout to prevent blocking
      const res = await Promise.race([
        smGet(`fixtures/${matchId}`, { include: inc }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error(`Timeout after ${TIMEOUT_MS}ms`)), TIMEOUT_MS)
        )
      ]);
      
      const payload = res?.data?.data || res?.data;
      if (payload) {
        payload._fetched_with_include = inc;
        return payload;
      }
      
      // Yield to event loop between attempts
      await yieldEventLoop();
    } catch (e) {
      lastErr = e;
      // Short circuit on timeout to avoid blocking
      if (e.message?.includes('Timeout')) {
        console.warn(`[matchSync] Timeout fetching ${matchId} with include ${inc}`);
        break;
      }
    }
  }

  if (lastErr) throw lastErr;
  return null;
}

// OPTIMIZED: Try to fetch team squad with aggressive timeout
async function fetchTeamSquad(teamId) {
  if (!teamId) return null;
  
  const candidates = [
    `teams/${teamId}/squad`,
    `teams/${teamId}/players`
  ]; // Reduced candidates to prevent blocking

  for (const p of candidates) {
    try {
      // Race against timeout
      const res = await Promise.race([
        smGet(p),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Squad fetch timeout')), 5_000)
        )
      ]);
      
      const payload = res?.data?.data || res?.data;
      if (payload && (Array.isArray(payload) || payload.players || payload.data)) {
        return payload;
      }
      
      // Yield between attempts
      await yieldEventLoop();
    } catch (e) {
      // Continue trying but don't block
      if (e.message?.includes('timeout')) break;
    }
  }
  return null;
}

// Compute the MOM candidate (highest rating)
function getMomCandidate(playerRatings = []) {
  if (!playerRatings.length) return null;
  return playerRatings.reduce((best, curr) => (curr.rating > (best.rating || 0) ? curr : best), {});
}

// OPTIMIZED Main sync function with timeouts and yielding
async function syncFinishedMatch(matchId) {
  console.log(`[matchSync] Starting optimized sync for match ${matchId}`);
  
  // Load match from DB with timeout
  const match = await Promise.race([
    Match.findOne({ match_id: matchId }),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('DB timeout')), 5_000)
    )
  ]);
  
  if (!match) throw new Error(`Match not found: ${matchId}`);

  // Yield to event loop
  await yieldEventLoop();

  // Check if already marked finished
  try {
    const shortName = match.match_status && (match.match_status.short_name || match.match_status.state);
    if (String(shortName || '').toUpperCase() === 'FT') {
      console.log(`[matchSync] Match ${matchId} already marked finished — will attempt to ensure lineup ratings are present.`);
    }
  } catch (e) {
    // ignore
  }

  // Fetch from SportMonks with aggressive timeout
  const smMatch = await fetchMatchStats(matchId, { forFinished: true, timeout: 10_000 });

  if (!smMatch) throw new Error(`No data from SportMonks for match ${matchId}`);

  // Yield to event loop before heavy processing
  await yieldEventLoop();

  // Normalise with timeout protection first
  let norm = null;
  try {
    const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
    // Race normalization against timeout
    norm = await Promise.race([
      Promise.resolve(normaliseFixtureToMatchDoc(smMatch) || {}),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Normalization timeout')), 3_000)
      )
    ]);
  } catch (e) {
    console.warn('[matchSync] normaliseFixtureToMatchDoc failed:', e.message || e);
    norm = {};
  }

  // Debug logging with normalized data
  try {
    const resolvedMatchContext = {
      home_team_id: norm.home_team_id ?? match.home_team_id,
      away_team_id: norm.away_team_id ?? match.away_team_id,
      home_team: norm.home_team ?? match.home_team,
      away_team: norm.away_team ?? match.away_team
    };
    console.debug('[matchSync] sportmonks fetch:', { 
      include: smMatch._fetched_with_include || null, 
      resolvedMatchContext 
    });
  } catch (e) {
    // non-fatal
  }

  // Yield after normalization
  await yieldEventLoop();

  // Extract provider player ratings with minimal processing
  let ratings = [];
  try {
    if (smMatch.rates?.data) {
      for (const r of smMatch.rates.data.slice(0, 50)) { // Limit to prevent blocking
        if (r.player && r.rating != null) {
          ratings.push({
            player: r.player.name,
            player_id: r.player.id || null,
            rating: Number(r.rating),
            team: r.team_id === smMatch.home_team_id ? smMatch.home_team.name : smMatch.away_team.name,
            inferred: false,
            source: 'sportmonks',
            calculated_at: new Date()
          });
        }
      }
    }

    // Extract from lineup.details with limits
    const rawLineups = smMatch.lineups?.data || smMatch.lineups || smMatch.lineup || [];
    const collectDetails = (items, maxItems = 50) => {
      let count = 0;
      for (const it of (items || [])) {
        if (count >= maxItems) break;
        const detailsArr = it.details || it.details?.data || [];
        for (const d of (detailsArr || [])) {
          if (count >= maxItems) break;
          try {
            if ((d.type_id === 118 || (d.type && Number(d.type) === 118)) && d.data && d.data.value != null) {
              ratings.push({
                player: d.player_name || d.player_name || null,
                player_id: d.player_id ?? d.player?.id ?? null,
                rating: Number(d.data.value),
                team_id: d.team_id || null,
                team: d.team_id == smMatch.home_team_id ? (smMatch.home_team?.name || null) : (smMatch.away_team?.name || null),
                inferred: false,
                source: 'sportmonks-lineup-detail',
                calculated_at: new Date()
              });
              count++;
            }
          } catch (e) { /* ignore malformed detail */ }
        }
        if (Array.isArray(it.players)) collectDetails(it.players, maxItems - count);
      }
    };

    if (norm && Array.isArray(norm.lineups)) collectDetails(norm.lineups);
    collectDetails(Array.isArray(rawLineups) ? rawLineups : (rawLineups.data || []));
  } catch (e) {
    console.warn('[matchSync] Rating extraction failed:', e.message);
  }

  // Yield after rating extraction
  await yieldEventLoop();

  // Get player stats (limited processing)
  const playerStats = (norm && Array.isArray(norm.player_stats)) ? norm.player_stats.slice(0, 50) : [];

  // Attach ratings to playerStats (simplified)
  if (ratings.length && playerStats.length) {
    const ratingMap = new Map(ratings.map(r => [String(r.player).toLowerCase(), r.rating]));
    for (const ps of playerStats) {
      const r = ratingMap.get(String(ps.player).toLowerCase());
      if (r != null) ps.rating = r;
    }
  }

  // Build lineup with limits to prevent blocking
  let lineupHome = [];
  let lineupAway = [];

  try {
    // Use normalized lineup if available
    lineupHome = (norm && norm.lineup && Array.isArray(norm.lineup.home)) ? norm.lineup.home.slice(0, 25) : [];
    lineupAway = (norm && norm.lineup && Array.isArray(norm.lineup.away)) ? norm.lineup.away.slice(0, 25) : [];
    
    if ((!lineupHome.length || !lineupAway.length) && smMatch.lineup) {
      const lups = smMatch.lineup?.data || smMatch.lineup || smMatch.lineups || smMatch.lineups?.data || [];
      for (const group of lups.slice(0, 10)) { // Limit groups
        const teamIsHome = group.team_id == smMatch.localteam_id || group.team_id == smMatch.home_team_id;
        const arr = (teamIsHome ? lineupHome : lineupAway);
        if (Array.isArray(group.players)) {
          for (const p of group.players.slice(0, 20)) { // Limit players per group
            arr.push({ 
              player_id: p.player_id ?? p.player?.id ?? p.id, 
              name: p.player?.name || p.player_name || p.name, 
              number: p.number ?? null, 
              position: p.position ?? p.role ?? null 
            });
          }
        }
      }
    }

    // Yield after lineup building
    await yieldEventLoop();

    // Only fetch team squads if absolutely necessary and lineup is empty
    if ((!lineupHome.length || !lineupAway.length) && (smMatch.home_team_id || smMatch.away_team_id)) {
      try {
        if (!lineupHome.length && lineupHome.length < 5) { // Only if very short
          const homeSquad = await fetchTeamSquad(smMatch.home_team_id || smMatch.localteam_id);
          if (homeSquad) {
            const players = Array.isArray(homeSquad) ? homeSquad : (homeSquad.players || homeSquad.data || []);
            for (const p of players.slice(0, 20)) { // Limit squad size
              lineupHome.push({ 
                player_id: p.id ?? p.player_id ?? p.player?.id, 
                name: p.fullname || p.name || p.player?.name || p.player_name || null, 
                number: p.number ?? null, 
                position: p.position ?? null 
              });
            }
          }
        }
        
        // Yield between squad fetches
        await yieldEventLoop();
        
        if (!lineupAway.length && lineupAway.length < 5) {
          const awaySquad = await fetchTeamSquad(smMatch.away_team_id || smMatch.visitorteam_id);
          if (awaySquad) {
            const players = Array.isArray(awaySquad) ? awaySquad : (awaySquad.players || awaySquad.data || []);
            for (const p of players.slice(0, 20)) {
              lineupAway.push({ 
                player_id: p.id ?? p.player_id ?? p.player?.id, 
                name: p.fullname || p.name || p.player?.name || p.player_name || null, 
                number: p.number ?? null, 
                position: p.position ?? null 
              });
            }
          }
        }
      } catch (e) {
        console.warn('[matchSync] team squad fetch failed (non-fatal):', e.message || e);
      }
    }
  } catch (e) {
    console.warn('[matchSync] lineup building failed:', e.message || e);
  }

  // Yield before final processing
  await yieldEventLoop();

  // Build prebuilt lineup with ratings (simplified)
  let prebuiltLineup = null;
  try {
    if ((lineupHome && lineupHome.length) || (lineupAway && lineupAway.length)) {
      const ratingMapById = new Map();
      const ratingMapByName = new Map();
      
      for (const r of (ratings || []).slice(0, 50)) { // Limit ratings processing
        if (r.player_id != null) ratingMapById.set(String(r.player_id), r.rating);
        if (r.player) ratingMapByName.set(String(r.player).toLowerCase(), r.rating);
      }
      
      const dbRatings = (match && Array.isArray(match.player_ratings)) ? match.player_ratings.slice(0, 50) : [];
      for (const r of dbRatings) {
        if (r.player_id != null && !ratingMapById.has(String(r.player_id)) && r.rating != null) {
          ratingMapById.set(String(r.player_id), r.rating);
        }
        if (r.player && !ratingMapByName.has(String(r.player).toLowerCase()) && r.rating != null) {
          ratingMapByName.set(String(r.player).toLowerCase(), r.rating);
        }
      }

      const attachRatingsTo = (arr) => (arr || []).map(p => {
        const pid = p.player_id != null ? String(p.player_id) : null;
        let rating = null;
        if (pid && ratingMapById.has(pid)) rating = ratingMapById.get(pid);
        else if (p.name && ratingMapByName.has(String(p.name).toLowerCase())) {
          rating = ratingMapByName.get(String(p.name).toLowerCase());
        }
        return { ...p, rating: rating ?? p.rating ?? null };
      });

      prebuiltLineup = { home: attachRatingsTo(lineupHome || []), away: attachRatingsTo(lineupAway || []) };
    }
  } catch (e) {
    console.warn('[matchSync] prebuild lineup with ratings failed:', e.message || e);
  }

  // Yield before database update
  await yieldEventLoop();

  // Pick MOM candidate
  const mom = getMomCandidate(ratings);

  // Build update payload (simplified)
  let eventsToPersist = Array.isArray(match.events) ? match.events : [];
  if (norm && Array.isArray(norm.events) && norm.events.length) {
    eventsToPersist = norm.events.slice(0, 100); // Limit events
  } else {
    const smEvents = smMatch.events?.data || smMatch.events || [];
    if (Array.isArray(smEvents) && smEvents.length) {
      eventsToPersist = smEvents.slice(0, 100);
    }
  }

  // Simplified comments merge
  let commentsToPersist = Array.isArray(match.comments) ? match.comments : [];
  if (norm && Array.isArray(norm.comments) && norm.comments.length) {
    // Simple merge - just append new comments
    const existingIds = new Set(commentsToPersist.map(c => c.id).filter(Boolean));
    const newComments = norm.comments.filter(c => !existingIds.has(c.id));
    commentsToPersist = [...commentsToPersist, ...newComments.slice(0, 50)]; // Limit new comments
  }

  // Determine minute/added_time
  let minuteToPersist = Number.isFinite(match.minute) ? match.minute : null;
  let addedTimeToPersist = Number.isFinite(match.added_time) ? match.added_time : null;
  if (norm && Number.isFinite(norm.minute)) {
    minuteToPersist = norm.minute;
  } else if (smMatch && smMatch.time) {
    minuteToPersist = Number(smMatch.time.minute ?? smMatch.time.current ?? minuteToPersist);
    addedTimeToPersist = Number(smMatch.time.added_time ?? smMatch.time.extra_minute ?? addedTimeToPersist);
  }

  // Simplified player ratings merge
  const mergePlayerRatings = (dbArr = [], incomingArr = []) => {
    const map = new Map();
    const keyFor = (r) => (r && r.player_id != null) ? `id:${r.player_id}` : 
      (r && r.player ? `name:${String(r.player).toLowerCase()}` : null);
    
    // Limit processing to prevent blocking
    for (const r of (dbArr || []).slice(0, 50)) {
      const k = keyFor(r);
      if (k && !map.has(k)) map.set(k, r);
    }
    
    for (const r of (incomingArr || []).slice(0, 50)) {
      const k = keyFor(r);
      if (!k) continue;
      const prev = map.get(k) || {};
      map.set(k, { ...prev, ...r, calculated_at: r.calculated_at || new Date() });
    }
    return Array.from(map.values());
  };

  const mergedPlayerRatings = mergePlayerRatings(match.player_ratings || [], ratings || []);

  // Build final update payload
  const setPayload = {
    player_ratings: mergedPlayerRatings,
    player_stats: playerStats,
    player_of_the_match: (mom && mom.player) ? mom.player : (match.player_of_the_match || null),
    events: eventsToPersist,
    comments: commentsToPersist,
    minute: Number.isFinite(minuteToPersist) ? minuteToPersist : (match.minute ?? null),
    added_time: Number.isFinite(addedTimeToPersist) ? addedTimeToPersist : (match.added_time ?? null),
    match_status: (norm && norm.match_status) ? norm.match_status : (
      smMatch?.state ? smMatch.state : (
        smMatch?.time ? {
          id: null,
          state: smMatch.time.status ?? '',
          name: smMatch.time.status ?? '',
          short_name: smMatch.time.status_code ?? '',
          developer_name: ''
        } : match.match_status || { id: null, state: '', name: '', short_name: '', developer_name: '' }
      )
    ),
    sources: { 
      sportmonks: { 
        last_fetched_with_include: smMatch._fetched_with_include || null, 
        last_fetched_at: new Date() 
      } 
    }
  };

  // Add prebuilt lineup if available
  if (prebuiltLineup) {
    setPayload.lineup = prebuiltLineup;
  }

  // Yield before database update
  await yieldEventLoop();

  // Clean payload for upsert
  const cleanForUpsert = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    const out = {};
    for (const k of Object.keys(obj)) {
      if (obj[k] !== undefined) out[k] = obj[k];
    }
    return out;
  };

  // Update match document with timeout
  const updated = await Promise.race([
    Match.findOneAndUpdate(
      { match_id: matchId },
      { $set: cleanForUpsert(setPayload) },
      { new: true }
    ),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database update timeout')), 10_000)
    )
  ]);

  // Yield after database update
  await yieldEventLoop();

  // Check for report generation (simplified)
  try {
    const prevShort = String((match.match_status && (match.match_status.short_name || match.match_status.state)) || '').toUpperCase();
    const newShort = String((updated.match_status && (updated.match_status.short_name || updated.match_status.state)) || '').toUpperCase();

    const becameFT = prevShort !== 'FT' && newShort === 'FT';

    if (becameFT) {
      console.log(`[matchSync] Match ${matchId} status transitioned to FT — queuing report generation.`);
      // Queue report generation asynchronously to avoid blocking
      setImmediate(async () => {
        try {
          const { generateBothReports } = require('./reportController');
          await generateBothReports(matchId);
        } catch (e) {
          console.warn('[matchSync] generateBothReports failed (non-fatal):', e.message || e);
        }
      });
    }
  } catch (e) {
    console.warn('[matchSync] report generation check failed:', e.message || e);
  }

  console.log(`[matchSync] Completed optimized sync for match ${matchId}`);
  return updated;
}

// Export
module.exports = { syncFinishedMatch, fetchMatchStats };