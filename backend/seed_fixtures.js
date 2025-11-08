// seed_fixtures.js
// Seeds fixtures from all 27+ available current league seasons from today to end of June 2026
// Dynamically fetches current seasons using SportMonks API and filters by available leagues
// Respects SportMonks rate limit of 3000 calls per hour

require('dotenv').config();
const { connectDB, closeDB } = require('./db/connect');
const { get } = require('./utils/sportmonks');
const Match = require('./models/Match');
const Team = require('./models/Team');

// Available leagues on the plan (league_id mapping)
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

// This will be populated dynamically by fetching current seasons
let CURRENT_SEASON_IDS = {};

// Rate limiting configuration
const RATE_LIMIT = {
  MAX_CALLS_PER_HOUR: 3000,
  SAFETY_MARGIN: 0.8, // Use only 80% of rate limit for safety
  BATCH_SIZE: 50, // Process fixtures in batches
  DELAY_BETWEEN_CALLS: 1500, // 1.5 seconds between API calls (gives us ~2400 calls/hour)
  DELAY_BETWEEN_BATCHES: 5000 // 5 seconds between batches
};

// Calculate effective rate limit with safety margin
const EFFECTIVE_RATE_LIMIT = Math.floor(RATE_LIMIT.MAX_CALLS_PER_HOUR * RATE_LIMIT.SAFETY_MARGIN);

// Track API calls for rate limiting
let apiCallCount = 0;
let apiCallStartTime = Date.now();

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Rate limiting helper
async function enforceRateLimit() {
  apiCallCount++;
  
  // Check if we've exceeded our hourly limit (only if we've been running for at least 1 minute)
  const timeSinceStart = Date.now() - apiCallStartTime;
  const minutesSinceStart = timeSinceStart / (1000 * 60);
  
  if (minutesSinceStart > 1) { // Only check rate limit after running for at least 1 minute
    const callsPerMinute = apiCallCount / minutesSinceStart;
    const projectedCallsPerHour = callsPerMinute * 60;
    
    if (projectedCallsPerHour > EFFECTIVE_RATE_LIMIT) {
      const waitTime = Math.max(1000, RATE_LIMIT.DELAY_BETWEEN_CALLS * 2); // Wait at least 1 second
      console.log(`⚠️  Rate limit projection: ${Math.round(projectedCallsPerHour)} calls/hour. Slowing down...`);
      await sleep(waitTime);
    }
  }
  
  // Standard delay between calls
  await sleep(RATE_LIMIT.DELAY_BETWEEN_CALLS);
}

// Fetch all current seasons for available leagues
async function fetchCurrentSeasons() {
  console.log('\n🔍 Fetching all current seasons with pagination...');
  
  try {
    let allSeasons = [];
    let page = 1;
    let hasMore = true;
    
    // Fetch all pages of seasons
    while (hasMore) {
      console.log(`📖 Fetching seasons page ${page}...`);
      
      await enforceRateLimit();
      
      const response = await get(`/seasons?page=${page}&per_page=100`); // Use larger page size
      const seasons = response.data?.data || [];
      const pagination = response.data?.pagination;
      
      allSeasons.push(...seasons);
      
      console.log(`   • Page ${page}: ${seasons.length} seasons (total so far: ${allSeasons.length})`);
      
      // Check if there are more pages
      hasMore = pagination?.has_more === true || (pagination?.next_page && seasons.length > 0);
      page++;
      
      // Safety limit to prevent infinite loops
      if (page > 100) {
        console.warn('⚠️  Reached page limit (100), stopping pagination');
        break;
      }
    }
    
    console.log(`📄 Found ${allSeasons.length} total seasons across ${page - 1} pages`);
    
    // Filter for current seasons in available leagues
    const currentSeasons = allSeasons.filter(season => 
      season.is_current === true && 
      AVAILABLE_LEAGUES.hasOwnProperty(season.league_id)
    );
    
    // Also check how many current seasons exist in total (for debugging)
    const allCurrentSeasons = allSeasons.filter(season => season.is_current === true);
    console.log(`� Total current seasons: ${allCurrentSeasons.length}`);
    console.log(`🎯 Current seasons for available leagues: ${currentSeasons.length}`);
    
    // Populate CURRENT_SEASON_IDS
    for (const season of currentSeasons) {
      const leagueName = AVAILABLE_LEAGUES[season.league_id];
      CURRENT_SEASON_IDS[season.id] = {
        league_id: season.league_id,
        league_name: leagueName,
        season_name: season.name,
        starting_at: season.starting_at,
        ending_at: season.ending_at
      };
      
      console.log(`   • ${leagueName}: ${season.name} (Season ID: ${season.id})`);
    }
    
    if (currentSeasons.length === 0) {
      console.warn('⚠️  No current seasons found for available leagues.');
      console.log('🔍 Debugging info:');
      console.log(`   • Total seasons fetched: ${allSeasons.length}`);
      console.log(`   • Total current seasons: ${allCurrentSeasons.length}`);
      console.log(`   • Available league IDs: ${Object.keys(AVAILABLE_LEAGUES).join(', ')}`);
      
      // Show a few examples of current seasons for debugging
      if (allCurrentSeasons.length > 0) {
        console.log('📝 Example current seasons found:');
        allCurrentSeasons.slice(0, 5).forEach(season => {
          console.log(`   • League ${season.league_id}: ${season.name} (Season ${season.id})`);
        });
      }
    }
    
    return currentSeasons;
    
  } catch (error) {
    console.error('❌ Error fetching current seasons:', error.message);
    
    if (error.response?.status === 429) {
      console.log('⏳ Rate limited, waiting 60 seconds...');
      await sleep(60000);
      // Retry once
      return await fetchCurrentSeasons();
    }
    
    throw error;
  }
}

// Get team by SportMonks ID or create if doesn't exist
async function getOrCreateTeam(teamData) {
  let team = await Team.findOne({ id: teamData.id });
  
  if (!team) {
    console.log(`📝 Creating team: ${teamData.name} (ID: ${teamData.id})`);
    team = new Team({
      id: teamData.id,
      name: teamData.name,
      short_code: teamData.short_code || '',
      image_path: teamData.image_path || '',
      founded: teamData.founded || null,
      country_id: teamData.country_id || null
    });
    await team.save();
  }
  
  return team;
}

// Transform SportMonks schedule fixture data to our Match format
function transformFixtureData(fixture, homeTeam, awayTeam) {
  const startingAt = new Date(fixture.starting_at);
  
  return {
    match_id: fixture.id,
    date: startingAt,
    match_info: {
      starting_at: startingAt,
      starting_at_timestamp: fixture.starting_at_timestamp || Math.floor(startingAt.getTime() / 1000),
      venue: {
        id: fixture.venue_id || null,
        name: '',
        address: '',
        capacity: null,
        image_path: '',
        city_name: ''
      },
      season: {
        id: fixture.season_id || null,
        name: '',
        is_current: true,
        starting_at: null,
        ending_at: null
      },
      league: {
        id: fixture.league_id || null,
        name: '',
        short_code: '',
        image_path: '',
        country_id: null
      }
    },
    teams: {
      home: {
        team_id: homeTeam.id,
        team_name: homeTeam.name,
        team_slug: homeTeam.slug
      },
      away: {
        team_id: awayTeam.id,
        team_name: awayTeam.name,
        team_slug: awayTeam.slug
      }
    },
    score: {
      home: 0,
      away: 0
    },
    match_status: {
      id: fixture.state_id || null,
      state: 'not_started',
      name: 'Not Started',
      short_name: 'NS',
      developer_name: 'not_started'
    },
    events: [],
    comments: [],
    lineups: [],
    lineup: { home: [], away: [] },
    player_ratings: []
  };
}

// Fetch fixtures for a specific season using schedules endpoint
async function fetchFixturesForSeason(seasonId, leagueName, startDate, endDate) {
  console.log(`\n🔍 Fetching ${leagueName} season schedule (ID: ${seasonId})...`);
  
  try {
    await enforceRateLimit();
    
    const response = await get(`/schedules/seasons/${seasonId}`);
    
    const data = response.data;
    const stages = Array.isArray(data.data) ? data.data : [];
    
    // Extract all fixtures from stages -> rounds -> fixtures structure
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
    
    // Filter fixtures by date range
    const filteredFixtures = allFixtures.filter(fixture => {
      if (!fixture.starting_at) return false;
      const fixtureDate = new Date(fixture.starting_at);
      return fixtureDate >= startDate && fixtureDate <= endDate;
    });
    
    console.log(`📄 Found ${allFixtures.length} total fixtures, ${filteredFixtures.length} in date range (${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]})`);
    
    return filteredFixtures;
    
  } catch (error) {
    console.error(`❌ Error fetching ${leagueName} schedule:`, error.message);
    
    if (error.response?.status === 429) {
      console.log('⏳ Rate limited, waiting 60 seconds...');
      await sleep(60000);
      // Retry once
      return await fetchFixturesForSeason(seasonId, leagueName, startDate, endDate);
    }
    
    throw error;
  }
}

// Process and save fixtures to database
async function processFixtures(fixtures, leagueName) {
  console.log(`\n💾 Processing ${fixtures.length} ${leagueName} fixtures...`);
  
  let processed = 0;
  let created = 0;
  let updated = 0;
  let errors = 0;
  
  // Process in batches to avoid overwhelming the database
  for (let i = 0; i < fixtures.length; i += RATE_LIMIT.BATCH_SIZE) {
    const batch = fixtures.slice(i, i + RATE_LIMIT.BATCH_SIZE);
    
    console.log(`📦 Processing batch ${Math.floor(i / RATE_LIMIT.BATCH_SIZE) + 1}/${Math.ceil(fixtures.length / RATE_LIMIT.BATCH_SIZE)} (${batch.length} fixtures)`);
    
    for (const fixture of batch) {
      try {
        // Find or create teams from embedded participants
        const participants = fixture.participants || [];
        if (participants.length < 2) {
          console.warn(`⚠️  Fixture ${fixture.id} missing participants, skipping`);
          errors++;
          continue;
        }
        
        const homeParticipant = participants.find(p => p.meta?.location === 'home');
        const awayParticipant = participants.find(p => p.meta?.location === 'away');
        
        if (!homeParticipant || !awayParticipant) {
          console.warn(`⚠️  Fixture ${fixture.id} missing home/away participants, skipping`);
          errors++;
          continue;
        }
        
        const homeTeam = await getOrCreateTeam(homeParticipant);
        const awayTeam = await getOrCreateTeam(awayParticipant);
        
        // Check if fixture already exists - skip if it does
        const existingMatch = await Match.findOne({ match_id: fixture.id });
        
        if (existingMatch) {
          console.log(`⏭️  Skipped (exists): ${fixture.name || `${homeTeam.name} vs ${awayTeam.name}`}`);
          processed++;
          continue;
        }
        
        // Create new match
        const matchData = transformFixtureData(fixture, homeTeam, awayTeam);
        const newMatch = new Match(matchData);
        await newMatch.save();
        created++;
        console.log(`➕ Created: ${fixture.name || `${homeTeam.name} vs ${awayTeam.name}`}`);
        processed++;
        
        processed++;
        
      } catch (error) {
        console.error(`❌ Error processing fixture ${fixture.id}:`, error.message);
        errors++;
      }
    }
    
    // Delay between batches
    if (i + RATE_LIMIT.BATCH_SIZE < fixtures.length) {
      console.log(`⏳ Waiting ${RATE_LIMIT.DELAY_BETWEEN_BATCHES / 1000}s before next batch...`);
      await sleep(RATE_LIMIT.DELAY_BETWEEN_BATCHES);
    }
  }
  
  console.log(`\n📊 ${leagueName} Processing Summary:`);
  console.log(`   • Processed: ${processed}`);
  console.log(`   • Created: ${created}`);
  console.log(`   • Skipped (existing): ${processed - created - errors}`);
  console.log(`   • Errors: ${errors}`);
  
  return { processed, created, skipped: processed - created - errors, errors };
}

// Main seeding function
async function seedFixtures() {
  console.log('🚀 Starting fixture seeding process for all available current seasons...');
  console.log(`📅 Date range: ${new Date().toISOString().split('T')[0]} to 2026-06-30`);
  console.log(`⚡ Rate limit: ${EFFECTIVE_RATE_LIMIT} calls/hour (${RATE_LIMIT.SAFETY_MARGIN * 100}% of ${RATE_LIMIT.MAX_CALLS_PER_HOUR})`);
  
  const startTime = Date.now();
  const startDate = new Date(); // Today
  const endDate = new Date('2026-06-30T23:59:59.999Z'); // End of June 2026
  
  let totalStats = {
    processed: 0,
    created: 0,
    updated: 0,
    errors: 0
  };
  
  try {
    await connectDB(process.env.DBURI);
    console.log('✅ Connected to database');
    
    // First, fetch all current seasons for available leagues
    try {
      await fetchCurrentSeasons();
      
      if (Object.keys(CURRENT_SEASON_IDS).length === 0) {
        console.log('❌ No current seasons found for available leagues. This could mean:');
        console.log('   • The seasons API returned no current seasons');
        console.log('   • None of the current seasons match our available league IDs');
        console.log('   • There might be an API authentication issue');
        return;
      }
    } catch (error) {
      console.error('❌ Failed to fetch current seasons:', error.message);
      console.log('💡 You might want to check your API token and connectivity');
      throw error;
    }
    
    console.log(`🎯 Processing ${Object.keys(CURRENT_SEASON_IDS).length} current seasons`);
    
    // Process each current season
    for (const [seasonId, seasonInfo] of Object.entries(CURRENT_SEASON_IDS)) {
      const leagueName = seasonInfo.league_name;
      
      try {
        console.log(`\n🏆 Processing ${leagueName} - ${seasonInfo.season_name}`);
        
        // Fetch fixtures for this season
        const fixtures = await fetchFixturesForSeason(parseInt(seasonId), leagueName, startDate, endDate);
        
        if (fixtures.length === 0) {
          console.log(`ℹ️  No fixtures found for ${leagueName}`);
          continue;
        }
        
        // Process and save fixtures
        const stats = await processFixtures(fixtures, leagueName);
        
        // Add to total stats
        totalStats.processed += stats.processed;
        totalStats.created += stats.created;
        totalStats.skipped = (totalStats.skipped || 0) + (stats.skipped || 0);
        totalStats.errors += stats.errors;
        
      } catch (error) {
        console.error(`❌ Error processing ${leagueName}:`, error.message);
        totalStats.errors++;
      }
    }
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    
    console.log('\n🎉 Fixture seeding completed for all available current seasons!');
    console.log(`⏱️  Total time: ${Math.floor(duration / 60)}m ${duration % 60}s`);
    console.log(`🏆 Leagues processed: ${Object.keys(CURRENT_SEASON_IDS).length}`);
    console.log(`📊 Overall Summary:`);
    console.log(`   • Total API calls: ${apiCallCount}`);
    console.log(`   • Fixtures processed: ${totalStats.processed}`);
    console.log(`   • Fixtures created: ${totalStats.created}`);
    console.log(`   • Fixtures skipped (existing): ${totalStats.skipped || 0}`);
    console.log(`   • Errors: ${totalStats.errors}`);
    
  } catch (error) {
    console.error('💥 Fatal error during seeding:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await closeDB();
    console.log('👋 Disconnected from database');
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Received SIGINT, shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Received SIGTERM, shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

// Run the seeder if called directly
if (require.main === module) {
  seedFixtures().catch(error => {
    console.error('💥 Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = { seedFixtures };