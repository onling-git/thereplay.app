require('dotenv').config();
const { connectDB } = require('./db/connect');

// Import the cup sync function from the cron
// We need to extract it from the cron file 
const { get } = require('./utils/sportmonks');
const Match = require('./models/Match');
const Team = require('./models/Team');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');

// Rate limiting
let apiCallCount = 0;
let apiCallStartTime = Date.now();

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function enforceRateLimit() {
  const now = Date.now();
  const hoursSinceStart = (now - apiCallStartTime) / (1000 * 60 * 60);
  
  if (hoursSinceStart >= 1) {
    apiCallCount = 0;
    apiCallStartTime = now;
  }
  
  if (apiCallCount >= 2900) { // Stay well under 3000/hour limit
    const waitTime = (3600 * 1000) - (now - apiCallStartTime);
    if (waitTime > 0) {
      console.log(`[rate-limit] Waiting ${Math.ceil(waitTime / 1000)}s for rate limit reset`);
      await sleep(waitTime);
      apiCallCount = 0;
      apiCallStartTime = Date.now();
    }
  }
  
  apiCallCount++;
  await sleep(1500); // Standard delay
}

// Manual cup sync function (similar to cron version)
async function manualCupSync() {
  console.log('🏆 Starting manual cup fixtures sync with stage data...');
  
  await connectDB(process.env.DBURI);
  
  const CUP_LEAGUES = {
    24: 'FA Cup (England)',
    27: 'Carabao Cup (England)',
    390: 'Coppa Italia (Italy)', 
    570: 'Copa Del Rey (Spain)',
    1371: 'UEFA Europa League Play-offs (Europe)'
  };
  
  try {
    const today = new Date();
    let totalProcessed = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    
    // Check just today for now
    const dateString = today.toISOString().split('T')[0];
    
    await enforceRateLimit();
    
    console.log(`📅 Checking cup fixtures for ${dateString}...`);
    
    const response = await get(`/fixtures/date/${dateString}`, {
      include: 'league,season,participants,stage,round'
    });
    
    const fixtures = response.data?.data || [];
    console.log(`📊 Total fixtures for ${dateString}: ${fixtures.length}`);
    
    const cupFixtures = fixtures.filter(fixture => 
      fixture.league && CUP_LEAGUES.hasOwnProperty(fixture.league.id)
    );
    
    console.log(`🏆 Cup fixtures found: ${cupFixtures.length}`);
    
    if (cupFixtures.length > 0) {
      for (const fixture of cupFixtures) {
        try {
          totalProcessed++;
          
          console.log(`\n🔄 Processing: ${fixture.name || 'Match'} (ID: ${fixture.id})`);
          console.log(`   League: ${CUP_LEAGUES[fixture.league.id]}`);
          console.log(`   Stage ID: ${fixture.stage_id || 'None'}`);
          console.log(`   Round ID: ${fixture.round_id || 'None'}`);
          
          // Check if exists
          const existingMatch = await Match.findOne({ match_id: fixture.id });
          
          if (existingMatch) {
            console.log('   ✅ Match exists in database');
            
            // Check if stage info is missing and we have it now
            if (!existingMatch.match_info?.stage && fixture.stage_id) {
              console.log('   📝 Updating with new stage information...');
              const normalizedData = normaliseFixtureToMatchDoc(fixture);
              if (normalizedData) {
                await Match.findOneAndUpdate(
                  { match_id: fixture.id },
                  { $set: { 'match_info.stage': normalizedData.match_info.stage, 'match_info.round': normalizedData.match_info.round } }
                );
                totalUpdated++;
                console.log('   ✅ Stage/round information updated');
              }
            }
          } else {
            console.log('   ➕ Creating new match...');
            
            const participants = fixture.participants || [];
            if (participants.length >= 2) {
              const homeParticipant = participants.find(p => p.meta?.location === 'home');
              const awayParticipant = participants.find(p => p.meta?.location === 'away');
              
              if (homeParticipant && awayParticipant) {
                // Create the match
                const normalizedData = normaliseFixtureToMatchDoc(fixture);
                if (normalizedData) {
                  const newMatch = new Match(normalizedData);
                  await newMatch.save();
                  totalCreated++;
                  console.log(`   ✅ Created: ${homeParticipant.name} vs ${awayParticipant.name}`);
                  console.log(`   📋 Stage: ${normalizedData.match_info?.stage?.name || 'Not specified'}`);
                }
              }
            }
          }
          
        } catch (fixtureError) {
          console.error(`   ❌ Error processing fixture ${fixture.id}:`, fixtureError.message);
        }
      }
    }
    
    console.log(`\n🎯 Sync complete: ${totalProcessed} processed, ${totalCreated} created, ${totalUpdated} updated`);
    
  } catch (error) {
    console.error('❌ Cup sync failed:', error.message);
  }
}

manualCupSync();