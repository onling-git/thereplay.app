// cron/cronOptimizedV2.js 
// Optimized cron jobs with efficient season-based syncing and removed 3-week lookahead
"use strict";

const cron = require("node-cron");
const axios = require("axios");
const { get } = require('../utils/sportmonks');

const BASE = process.env.SELF_BASE || "http://localhost:8000";
const ADMIN_KEY = process.env.ADMIN_API_KEY;

// Shared axios instance for internal API calls
const api = axios.create({ 
  baseURL: BASE, 
  headers: { 'x-api-key': ADMIN_KEY }, 
  timeout: 30_000
});

// Available leagues on the plan (same as seed script)
const AVAILABLE_LEAGUES = {
  181: 'Admiral Bundesliga (Austria)',
  208: 'Pro League (Belgium)', 
  244: '1. HNL (Croatia)',
  271: 'Superliga (Denmark)',
  8: 'Premier League (England)',
  24: 'FA Cup (England)',
  9: 'Championship (England)',
  27: 'Carabao Cup (England)',
  1371: 'UEFA Europa League Play-offs (Europe)',
  301: 'Ligue 1 (France)',
  82: 'Bundesliga (Germany)',
  387: 'Serie B (Italy)',
  384: 'Serie A (Italy)',
  390: 'Coppa Italia (Italy)',
  72: 'Eredivisie (Netherlands)',
  444: 'Eliteserien (Norway)',
  453: 'Ekstraklasa (Poland)',
  462: 'Liga Portugal (Portugal)',
  486: 'Premier League (Russia)',
  501: 'Premiership (Scotland)',
  570: 'Copa Del Rey (Spain)',
  567: 'La Liga 2 (Spain)',
  564: 'La Liga (Spain)',
  573: 'Allsvenskan (Sweden)',
  591: 'Super League (Switzerland)',
  600: 'Super Lig (Turkey)',
  609: 'Premier League (Ukraine)'
};

// Cache for current seasons (refreshed daily)
let CURRENT_SEASON_IDS = {};
let seasonsLastFetched = 0;
const SEASONS_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiting helpers
let apiCallCount = 0;
let apiCallStartTime = Date.now();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function yieldEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

async function enforceRateLimit() {
  apiCallCount++;
  
  const timeSinceStart = Date.now() - apiCallStartTime;
  const minutesSinceStart = timeSinceStart / (1000 * 60);
  
  if (minutesSinceStart > 1) {
    const callsPerMinute = apiCallCount / minutesSinceStart;
    const projectedCallsPerHour = callsPerMinute * 60;
    
    if (projectedCallsPerHour > 2400) { // 80% of rate limit
      await sleep(2000); // Slow down
    }
  }
  
  await sleep(1500); // Standard delay
}

// Fetch current seasons for available leagues (similar to seed script)
async function fetchCurrentSeasons() {
  const now = Date.now();
  if (CURRENT_SEASON_IDS && Object.keys(CURRENT_SEASON_IDS).length > 0 && (now - seasonsLastFetched) < SEASONS_CACHE_TTL) {
    return CURRENT_SEASON_IDS;
  }

  console.log('[cron] Fetching current seasons for efficient sync...');
  
  try {
    let allSeasons = [];
    let page = 1;
    let hasMore = true;
    
    while (hasMore && page <= 20) { // Safety limit
      await enforceRateLimit();
      
      const response = await get(`/seasons?page=${page}&per_page=100`);
      const seasons = response.data?.data || [];
      const pagination = response.data?.pagination;
      
      allSeasons.push(...seasons);
      
      hasMore = pagination?.has_more === true || (pagination?.next_page && seasons.length > 0);
      page++;
    }
    
    // Filter for current seasons in available leagues
    const currentSeasons = allSeasons.filter(season => 
      season.is_current === true && 
      AVAILABLE_LEAGUES.hasOwnProperty(season.league_id)
    );
    
    // Reset cache
    CURRENT_SEASON_IDS = {};
    
    for (const season of currentSeasons) {
      const leagueName = AVAILABLE_LEAGUES[season.league_id];
      CURRENT_SEASON_IDS[season.id] = {
        league_id: season.league_id,
        league_name: leagueName,
        season_name: season.name,
        starting_at: season.starting_at,
        ending_at: season.ending_at
      };
    }
    
    seasonsLastFetched = now;
    console.log(`[cron] Cached ${currentSeasons.length} current seasons for efficient sync`);
    
    return CURRENT_SEASON_IDS;
    
  } catch (error) {
    console.error('[cron] Error fetching current seasons:', error.message);
    return CURRENT_SEASON_IDS; // Return cached version if available
  }
}

// Chunked processing helper
async function processInChunks(items, processor, chunkSize = 5) {
  const results = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const chunkResults = await Promise.all(chunk.map(processor));
    results.push(...chunkResults);
    
    if (i + chunkSize < items.length) {
      await yieldEventLoop();
    }
  }
  return results;
}

// Simple job lock to avoid overlapping runs
const jobLocks = new Set();
async function runIfNotRunning(name, fn) {
  if (jobLocks.has(name)) {
    console.log(`[cron] Skipping ${name} because previous run still in progress`);
    return;
  }
  jobLocks.add(name);
  try {
    await fn();
  } catch (err) {
    throw err;
  } finally {
    jobLocks.delete(name);
  }
}

// Efficient season-based fixture sync for upcoming 7 days
async function syncUpcomingFixturesBySeasons() {
  console.log('[cron] Starting efficient season-based fixture sync...');
  
  try {
    // Get current seasons
    const seasons = await fetchCurrentSeasons();
    
    if (!seasons || Object.keys(seasons).length === 0) {
      console.log('[cron] No current seasons available for sync');
      return;
    }
    
    const today = new Date();
    const endDate = new Date(today.getTime() + (7 * 24 * 60 * 60 * 1000)); // +7 days
    
    let totalProcessed = 0;
    let totalUpdated = 0;
    let errors = 0;
    
    console.log(`[cron] Syncing fixtures for ${Object.keys(seasons).length} seasons from ${today.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    // Process seasons in small batches
    const seasonIds = Object.keys(seasons);
    const BATCH_SIZE = 3; // Small batch size to avoid overwhelming API
    
    for (let i = 0; i < seasonIds.length; i += BATCH_SIZE) {
      const batch = seasonIds.slice(i, i + BATCH_SIZE);
      
      const worker = async (seasonId) => {
        const seasonInfo = seasons[seasonId];
        try {
          await enforceRateLimit();
          
          // Fetch schedule for this season
          const response = await get(`/schedules/seasons/${seasonId}`);
          const data = response.data;
          const stages = Array.isArray(data.data) ? data.data : [];
          
          // Extract fixtures from stages -> rounds -> fixtures structure
          const allFixtures = [];
          for (const stage of stages) {
            if (stage.rounds && Array.isArray(stage.rounds)) {
              for (const round of stage.rounds) {
                if (round.fixtures && Array.isArray(round.fixtures)) {
                  allFixtures.push(...round.fixtures);
                }
              }
            }
          }
          
          // Filter fixtures for the next 7 days
          const relevantFixtures = allFixtures.filter(fixture => {
            if (!fixture.starting_at) return false;
            const fixtureDate = new Date(fixture.starting_at);
            return fixtureDate >= today && fixtureDate <= endDate;
          });
          
          console.log(`[cron] ${seasonInfo.league_name}: ${relevantFixtures.length} fixtures in next 7 days`);
          
          if (relevantFixtures.length > 0) {
            // Use existing match sync logic
            const Match = require('../models/Match');
            const Team = require('../models/Team');
            const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');
            
            for (const fixture of relevantFixtures) {
              try {
                // Check if fixture already exists
                const existingMatch = await Match.findOne({ match_id: fixture.id });
                
                if (existingMatch) {
                  // Check if we need to update (date/time changes, etc.)
                  const fixtureStartingAt = new Date(fixture.starting_at);
                  const existingStartingAt = existingMatch.match_info?.starting_at ? new Date(existingMatch.match_info.starting_at) : null;
                  
                  if (!existingStartingAt || Math.abs(fixtureStartingAt.getTime() - existingStartingAt.getTime()) > 60000) { // 1 minute difference
                    // Update the fixture
                    const normalizedData = normaliseFixtureToMatchDoc(fixture);
                    if (normalizedData) {
                      await Match.findOneAndUpdate(
                        { match_id: fixture.id },
                        { $set: normalizedData }
                      );
                      totalUpdated++;
                      console.log(`[cron] Updated fixture: ${fixture.id} (time changed)`);
                    }
                  }
                } else {
                  // Create new fixture
                  const participants = fixture.participants || [];
                  if (participants.length >= 2) {
                    const homeParticipant = participants.find(p => p.meta?.location === 'home');
                    const awayParticipant = participants.find(p => p.meta?.location === 'away');
                    
                    if (homeParticipant && awayParticipant) {
                      // Ensure teams exist
                      const homeTeam = await Team.findOneAndUpdate(
                        { id: homeParticipant.id },
                        {
                          $setOnInsert: {
                            id: homeParticipant.id,
                            name: homeParticipant.name,
                            short_code: homeParticipant.short_code || '',
                            image_path: homeParticipant.image_path || '',
                            founded: homeParticipant.founded || null,
                            country_id: homeParticipant.country_id || null
                          }
                        },
                        { upsert: true, new: true }
                      );
                      
                      const awayTeam = await Team.findOneAndUpdate(
                        { id: awayParticipant.id },
                        {
                          $setOnInsert: {
                            id: awayParticipant.id,
                            name: awayParticipant.name,
                            short_code: awayParticipant.short_code || '',
                            image_path: awayParticipant.image_path || '',
                            founded: awayParticipant.founded || null,
                            country_id: awayParticipant.country_id || null
                          }
                        },
                        { upsert: true, new: true }
                      );
                      
                      // Create match document
                      const normalizedData = normaliseFixtureToMatchDoc(fixture);
                      if (normalizedData) {
                        const newMatch = new Match(normalizedData);
                        await newMatch.save();
                        totalProcessed++;
                        console.log(`[cron] Created new fixture: ${fixture.id}`);
                      }
                    }
                  }
                }
              } catch (fixtureError) {
                errors++;
                console.error(`[cron] Error processing fixture ${fixture.id}:`, fixtureError.message);
              }
            }
          }
          
        } catch (seasonError) {
          errors++;
          console.error(`[cron] Error processing season ${seasonId} (${seasonInfo.league_name}):`, seasonError.message);
        }
      };
      
      // Process batch with small delay
      await processInChunks(batch, worker, 1);
      
      if (i + BATCH_SIZE < seasonIds.length) {
        await sleep(2000); // 2 second delay between batches
      }
    }
    
    console.log(`[cron] Season-based fixture sync complete: ${totalProcessed} created, ${totalUpdated} updated, ${errors} errors`);
    
    // Update team next_match info if new fixtures were added
    if (totalProcessed > 0) {
      console.log('[cron] Updating team next_match info due to new fixtures...');
      await refreshTeamNextMatchInfo();
    }
    
  } catch (error) {
    console.error('[cron] Season-based fixture sync failed:', error.message);
  }
}

// Check for newly finished matches and generate instant reports
async function checkForFinishedMatchesAndGenerateReports(matchIds, previousStates) {
  try {
    const Match = require('../models/Match');
    
    // Get current states of the updated matches
    const updatedMatches = await Match.find({
      match_id: { $in: matchIds }
    }).select('match_id match_status teams home_team_slug away_team_slug reports').lean();
    
    const finishedMatches = [];
    
    for (const match of updatedMatches) {
      const currentState = match.match_status?.state || match.match_status?.short_name || match.match_status?.developer_name;
      const previousState = previousStates[match.match_id];
      
      // Check if match just finished (status changed to FT, finished, or ended)
      const isNowFinished = ['FT', 'finished', 'ended', 'full-time'].includes(currentState?.toLowerCase());
      const wasNotFinished = !['FT', 'finished', 'ended', 'full-time'].includes(previousState?.toLowerCase());
      
      if (isNowFinished && wasNotFinished) {
        // Match just finished - add to list for report generation
        finishedMatches.push(match);
        console.log(`[cron] 🎯 Match ${match.match_id} just finished (${previousState} → ${currentState})`);
      }
    }
    
    if (finishedMatches.length > 0) {
      console.log(`[cron] 📊 Generating instant reports for ${finishedMatches.length} newly finished matches...`);
      
      // Generate reports for newly finished matches
      const reportWorker = async (match) => {
        try {
          // Skip if reports already exist
          if (match.reports?.home && match.reports?.away) {
            console.log(`[cron] Skipping reports for match ${match.match_id} (already exist)`);
            return;
          }
          
          const homeSlug = match.home_team_slug || 
                          match.teams?.home?.team_slug || 
                          (match.teams?.home?.team_name ? match.teams.home.team_name.toLowerCase().replace(/\s+/g,'-') : `home-${match.match_id}`);
          
          await axios.post(`${BASE}/api/reports/${homeSlug}/match/${match.match_id}/generate-both`, {}, {
            headers: { 'x-api-key': ADMIN_KEY },
            timeout: 45_000 // Longer timeout for instant generation
          });
          
          console.log(`[cron] ✅ Generated instant reports for match ${match.match_id}`);
          
        } catch (e) {
          console.error(`[cron] ❌ Instant report generation failed for match ${match.match_id}:`, e?.response?.data || e.message || e);
        }
      };
      
      // Process finished matches with small delay to avoid overwhelming
      await processInChunks(finishedMatches, reportWorker, 2);
      
    } else {
      console.log('[cron] No newly finished matches found');
    }
    
  } catch (error) {
    console.error('[cron] Error checking for finished matches:', error.message);
  }
}

// Refresh team next_match info (optimized version)
async function refreshTeamNextMatchInfo() {
  try {
    const Team = require('../models/Team');
    const Match = require('../models/Match');
    
    // Get teams that might need next_match updates
    const teams = await Team.find({})
      .select('id slug name next_match next_game_at')
      .limit(100) // Process in batches
      .lean();
    
    let updated = 0;
    
    for (const team of teams) {
      try {
        // Find next upcoming match for this team
        const now = new Date();
        const nextMatch = await Match.findOne({
          $or: [
            { 'teams.home.team_id': team.id },
            { 'teams.away.team_id': team.id }
          ],
          $or: [
            { 'match_info.starting_at': { $gt: now } },
            { date: { $gt: now } }
          ]
        })
        .sort({ 'match_info.starting_at': 1, date: 1 })
        .lean();
        
        if (nextMatch) {
          const nextMatchDate = nextMatch.match_info?.starting_at || nextMatch.date;
          
          // Update if different from current next_match
          if (team.next_match !== nextMatch.match_id || 
              !team.next_game_at || 
              Math.abs(new Date(nextMatchDate).getTime() - new Date(team.next_game_at).getTime()) > 60000) {
            
            await Team.findOneAndUpdate(
              { id: team.id },
              {
                $set: {
                  next_match: nextMatch.match_id,
                  next_game_at: new Date(nextMatchDate)
                }
              }
            );
            updated++;
          }
        }
        
      } catch (teamError) {
        console.error(`[cron] Error updating team ${team.slug}:`, teamError.message);
      }
    }
    
    console.log(`[cron] Team next_match refresh complete: ${updated} teams updated`);
    
  } catch (error) {
    console.error('[cron] Team next_match refresh failed:', error.message);
  }
}

async function validateAndFixTeamMatchReferences() {
  try {
    const Team = require('../models/Team');
    const Match = require('../models/Match');
    
    console.log('[cron] Starting daily validation of team match references...');
    
    const teams = await Team.find({
      $or: [
        { last_match: { $exists: true, $ne: null } },
        { next_match: { $exists: true, $ne: null } }
      ]
    }).select('id slug last_match next_match last_played_at next_game_at').lean();
    
    console.log(`[cron] Validating ${teams.length} teams with match references...`);
    
    let lastMatchFixed = 0;
    let nextMatchFixed = 0;
    
    for (const team of teams) {
      try {
        // Validate last_match reference
        if (team.last_match) {
          const lastMatch = await Match.findOne({ 
            match_id: team.last_match 
          }).select('match_id match_status teams match_info date').lean();
          
          if (lastMatch) {
            const state = lastMatch.match_status?.state || lastMatch.match_status?.name || lastMatch.status;
            const isFinished = String(state || '').toLowerCase().includes('finished');
            
            // If referenced match is not actually finished, find the real last match
            if (!isFinished) {
              console.log(`[cron] Team ${team.slug}: last_match ${team.last_match} is not finished (${state}), finding correct last match...`);
              
              const realLastMatch = await Match.findOne({
                $or: [
                  { 'teams.home.team_id': team.id },
                  { 'teams.away.team_id': team.id }
                ],
                'match_status.state': 'finished',
                $or: [
                  { 'match_info.starting_at': { $exists: true } },
                  { date: { $exists: true } }
                ]
              })
              .sort({ 
                'match_info.starting_at': -1, 
                date: -1 
              })
              .lean();
              
              if (realLastMatch) {
                await Team.findOneAndUpdate(
                  { id: team.id },
                  {
                    $set: {
                      last_match: realLastMatch.match_id,
                      last_played_at: realLastMatch.match_info?.starting_at || realLastMatch.date
                    }
                  }
                );
                lastMatchFixed++;
                console.log(`[cron] Fixed ${team.slug}: last_match ${team.last_match} → ${realLastMatch.match_id}`);
              } else {
                // No finished matches found, clear last_match
                await Team.findOneAndUpdate(
                  { id: team.id },
                  {
                    $set: {
                      last_match: null,
                      last_played_at: null
                    }
                  }
                );
                lastMatchFixed++;
                console.log(`[cron] Cleared ${team.slug}: no finished matches found`);
              }
            }
          } else {
            // Referenced match doesn't exist, clear the reference
            console.log(`[cron] Team ${team.slug}: last_match ${team.last_match} not found, clearing...`);
            await Team.findOneAndUpdate(
              { id: team.id },
              {
                $set: {
                  last_match: null,
                  last_played_at: null
                }
              }
            );
            lastMatchFixed++;
          }
        }
        
        // Validate next_match reference
        if (team.next_match) {
          const nextMatch = await Match.findOne({ 
            match_id: team.next_match 
          }).select('match_id match_status teams match_info date').lean();
          
          if (nextMatch) {
            const state = nextMatch.match_status?.state || nextMatch.match_status?.name || nextMatch.status;
            const isFinished = String(state || '').toLowerCase().includes('finished');
            const isCancelled = String(state || '').toLowerCase().includes('cancelled') || 
                               String(state || '').toLowerCase().includes('postponed');
            
            // If referenced match is finished or cancelled, find the real next match
            if (isFinished || isCancelled) {
              console.log(`[cron] Team ${team.slug}: next_match ${team.next_match} is ${state}, finding correct next match...`);
              
              const now = new Date();
              const realNextMatch = await Match.findOne({
                $or: [
                  { 'teams.home.team_id': team.id },
                  { 'teams.away.team_id': team.id }
                ],
                'match_status.state': { $ne: 'finished' },
                $or: [
                  { 'match_info.starting_at': { $gt: now } },
                  { date: { $gt: now } }
                ]
              })
              .sort({ 
                'match_info.starting_at': 1, 
                date: 1 
              })
              .lean();
              
              if (realNextMatch) {
                await Team.findOneAndUpdate(
                  { id: team.id },
                  {
                    $set: {
                      next_match: realNextMatch.match_id,
                      next_game_at: realNextMatch.match_info?.starting_at || realNextMatch.date
                    }
                  }
                );
                nextMatchFixed++;
                console.log(`[cron] Fixed ${team.slug}: next_match ${team.next_match} → ${realNextMatch.match_id}`);
              } else {
                // No upcoming matches found, clear next_match
                await Team.findOneAndUpdate(
                  { id: team.id },
                  {
                    $set: {
                      next_match: null,
                      next_game_at: null
                    }
                  }
                );
                nextMatchFixed++;
                console.log(`[cron] Cleared ${team.slug}: no upcoming matches found`);
              }
            }
          } else {
            // Referenced match doesn't exist, clear the reference
            console.log(`[cron] Team ${team.slug}: next_match ${team.next_match} not found, clearing...`);
            await Team.findOneAndUpdate(
              { id: team.id },
              {
                $set: {
                  next_match: null,
                  next_game_at: null
                }
              }
            );
            nextMatchFixed++;
          }
        }
        
      } catch (teamError) {
        console.error(`[cron] Error validating team ${team.slug}:`, teamError.message);
      }
    }
    
    console.log(`[cron] Daily validation complete: ${lastMatchFixed} last_match fixed, ${nextMatchFixed} next_match fixed`);
    
  } catch (error) {
    console.error('[cron] Daily validation failed:', error.message);
  }
}

function startCrons() {
  const scheduledTasks = [];

  // 1) Live match sync with instant report generation — every 2 minutes
  const liveNowTask = cron.schedule("*/2 * * * *", async () => {
    await runIfNotRunning('live-now', async () => {
      try {
        // Store previous match states before sync
        const Match = require('../models/Match');
        const liveMatches = await Match.find({
          'match_status.state': { $in: ['inplay', 'live', '1H', '2H', 'HT'] }
        }).select('match_id match_status').lean();
        
        const previousStates = {};
        liveMatches.forEach(match => {
          previousStates[match.match_id] = match.match_status?.state || match.match_status?.short_name;
        });
        
        // Perform live sync
        const { data } = await api.post('/api/sync/live-now', {}, { timeout: 15_000 });
        console.log('[cron] live-now sync ok', { foundLive: data.foundLive, upserts: data.upsertedCount });
        
        // Check for newly finished matches and trigger instant reports
        if (data.match_ids && data.match_ids.length > 0) {
          await checkForFinishedMatchesAndGenerateReports(data.match_ids, previousStates);
        }
        
      } catch (e) {
        const body = e?.response?.data || e.message;
        console.error('[cron] live-now sync failed', body);
        const is429 = e?.response?.status === 429 || /rate limit/i.test(JSON.stringify(body || ''));
        if (is429) {
          console.warn(`[cron] live-now rate-limited. Cooling off for 30s...`);
          await sleep(30000);
        }
      }
    });
  });
  scheduledTasks.push(liveNowTask);

  // 2) EFFICIENT upcoming fixtures sync - every 6 hours using season-based approach
  const upcomingFixturesTask = cron.schedule('0 */6 * * *', async () => {
    await runIfNotRunning('upcoming-fixtures', async () => {
      await syncUpcomingFixturesBySeasons();
    });
  });
  scheduledTasks.push(upcomingFixturesTask);

  // 3) Pre-match lineup fetch — every 5 minutes (unchanged but optimized)
  const preMatchLineupTask = cron.schedule('*/5 * * * *', async () => {
    await runIfNotRunning('pre-match-lineup', async () => {
      try {
        const now = new Date();
        const lookaheadMin = Number(process.env.CRON_PREMATCH_LOOKAHEAD_MIN || 45);
        const lookaheadMax = Number(process.env.CRON_PREMATCH_LOOKAHEAD_MAX || 70);

        const windowStart = new Date(now.getTime() + (lookaheadMin * 60 * 1000));
        const windowEnd = new Date(now.getTime() + (lookaheadMax * 60 * 1000));

        const Match = require('../models/Match');
        
        const upcoming = await Match.find({
          $or: [
            { 'match_info.starting_at': { $gte: windowStart, $lte: windowEnd } },
            { date: { $gte: windowStart, $lte: windowEnd } }
          ]
        }).limit(20).lean();

        if (!upcoming || !upcoming.length) {
          return console.log(`[cron] No matches due for lineup fetch in ${lookaheadMin}-${lookaheadMax}min window.`);
        }

        console.log(`[cron] Found ${upcoming.length} matches to check for lineups`);

        const { fetchMatchStats } = require('../controllers/matchSyncController');
        const { normaliseFixtureToMatchDoc } = require('../utils/normaliseFixture');

        const worker = async (m) => {
          try {
            const sm = await Promise.race([
              fetchMatchStats(m.match_id),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10_000))
            ]);
            
            if (!sm) return;
            
            const norm = normaliseFixtureToMatchDoc(sm) || {};
            let lineup = (norm && norm.lineup) ? norm.lineup : { home: [], away: [] };

            const lineupToSave = { 
              home: (lineup.home || []).map(p => ({ ...p, rating: null })), 
              away: (lineup.away || []).map(p => ({ ...p, rating: null })) 
            };

            const lineupsFlattened = [];
            const pushFlat = (arr, teamId) => {
              for (const p of (arr || [])) {
                lineupsFlattened.push({
                  player_id: p.player_id ?? null,
                  team_id: p.team_id ?? teamId ?? null,
                  player_name: p.player_name || p.name || p.player || '',
                  position_id: p.position_id ?? p.position ?? null,
                  formation_field: p.formation_field ?? null,
                  formation_position: p.formation_position ?? p.role ?? null,
                  jersey_number: p.jersey_number ?? p.number ?? null,
                  type_id: p.type_id ?? null,
                  details: []
                });
              }
            };
            pushFlat(lineupToSave.home || [], m.home_team_id || m.homeId || null);
            pushFlat(lineupToSave.away || [], m.away_team_id || m.awayId || null);

            await Match.findOneAndUpdate(
              { match_id: m.match_id }, 
              { $set: { lineup: lineupToSave, lineups: lineupsFlattened } }
            );
            console.log(`[cron] Persisted lineup for match ${m.match_id}`);
          } catch (e) {
            console.warn('[cron] Failed to fetch/persist lineup for match', m.match_id, e?.message || e);
          }
        };

        await processInChunks(upcoming, worker, 3);
        
      } catch (err) {
        console.error('[cron] pre-match lineup fetch job failed', err?.response?.data || err.message || err);
      }
    });
  });
  scheduledTasks.push(preMatchLineupTask);

  // 4) Backup reports generation — daily at 4:30 AM (catches any missed reports)
  const reportsTask = cron.schedule('30 4 * * *', async () => {
    await runIfNotRunning('reports-backup', async () => {
      try {
        console.log('[cron] Running backup report generation for any missed matches...');
        
        const Match = require('../models/Match');
        const yesterday = new Date(Date.now() - (24 * 60 * 60 * 1000));
        const now = new Date();

        // Only look for finished matches from yesterday that somehow missed instant report generation
        const matches = await Match.find({
          'match_info.starting_at': { $gte: yesterday, $lte: now },
          'match_status.state': { $in: ['FT', 'finished', 'ended', 'full-time'] },
          $or: [
            { 'reports.home': { $exists: false } },
            { 'reports.away': { $exists: false } },
            { reports: { $exists: false } }
          ]
        }).limit(20).lean(); // Reduced limit since this should catch very few matches

        if (!matches || !matches.length) {
          console.log('[cron] ✅ No missed reports found - instant report generation working well!');
          return;
        }

        console.log(`[cron] 🔧 Found ${matches.length} finished matches missing reports - generating backup reports...`);

        const worker = async (m) => {
          try {
            const homeSlug = m.home_team_slug || 
                            m.teams?.home?.team_slug || 
                            (m.teams?.home?.team_name ? m.teams.home.team_name.toLowerCase().replace(/\s+/g,'-') : `home-${m.match_id}`);
                            
            await axios.post(`${BASE}/api/reports/${homeSlug}/match/${m.match_id}/generate-both`, {}, {
              headers: { 'x-api-key': ADMIN_KEY },
              timeout: 30_000
            });
            console.log(`[cron] Generated backup report for match ${m.match_id}`);
          } catch (e) {
            console.error('[cron] backup report generation failed for', m.match_id, e?.response?.data || e.message || e);
          }
        };

        await processInChunks(matches, worker, 3);
        
      } catch (err) {
        console.error('[cron] backup reports generation failed', err);
      }
    });
  });
  scheduledTasks.push(reportsTask);

  // 5) Team match info refresh — daily at 5 AM (optimized)
  const teamMatchInfoTask = cron.schedule('0 5 * * *', async () => {
    await runIfNotRunning('team-match-info-refresh', async () => {
      try {
        console.log('[cron] Starting team match info refresh...');
        
        const { findStaleTeams, batchRefreshTeamCache } = require('../utils/teamCacheUtils');
        
        const STALE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
        const BATCH_SIZE = 50;
        
        const staleTeams = await findStaleTeams(STALE_TTL_MS, BATCH_SIZE);
        
        if (!staleTeams || staleTeams.length === 0) {
          console.log('[cron] No stale team caches found');
          return;
        }

        console.log(`[cron] Refreshing ${staleTeams.length} stale team caches...`);
        
        const teamSlugs = staleTeams.map(team => team.slug);
        const refreshResult = await batchRefreshTeamCache(teamSlugs, 'cron', {
          concurrency: 5,
          delayMs: 200,
          stopOnError: false
        });

        console.log(`[cron] Team cache refresh complete:`, {
          total: refreshResult.total,
          successful: refreshResult.successful,
          updated: refreshResult.updated,
          failed: refreshResult.failed
        });
        
      } catch (e) {
        console.error('[cron] team match info refresh failed', e?.message || e);
      }
    });
  });
  scheduledTasks.push(teamMatchInfoTask);

  // Daily validation of team match references (handles postponed/cancelled matches)
  const dailyValidationTask = cron.schedule('0 3 * * *', async () => {
    await runIfNotRunning('daily-match-validation', async () => {
      console.log('[cron] Starting daily team match validation...');
      await validateAndFixTeamMatchReferences();
    });
  });
  scheduledTasks.push(dailyValidationTask);

  // REMOVED: Three-week lookahead task (no longer needed due to efficient seeding)
  
  console.log("[cron] Optimized V2 scheduler started with instant report generation, efficient season-based sync, and daily validation.");

  // Expose stopper for server shutdown
  async function stopCrons() {
    console.log('[cron] Stopping scheduled tasks...');
    for (const t of scheduledTasks) {
      try {
        if (t && typeof t.stop === 'function') t.stop();
      } catch (e) {
        console.warn('[cron] Failed to stop a task', e?.message || e);
      }
    }
  }

  module.exports.stopCrons = stopCrons;
}

module.exports = { startCrons };