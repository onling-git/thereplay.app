// Check standings endpoint from Sportmonks API
require('dotenv').config();
const { get } = require('./utils/sportmonks');

const PREMIER_LEAGUE_ID = 8;  // English Premier League
const CHAMPIONSHIP_ID = 9;    // English Championship
const FA_CUP_ID = 24;         // FA Cup

(async () => {
  try {
    console.log('='.repeat(80));
    console.log('🏆 TESTING SPORTMONKS STANDINGS API');
    console.log('='.repeat(80));
    console.log('\n');

    // Step 1: Get current season for Premier League to find season ID
    console.log('📅 Step 1: Finding current season for Premier League...');
    const leagueResponse = await get(`/leagues/${PREMIER_LEAGUE_ID}`, {
      include: 'currentseason'
    });
    
    const league = leagueResponse.data?.data;
    if (!league) {
      console.log('❌ Could not fetch league data');
      return;
    }

    console.log(`League: ${league.name} (ID: ${league.id})`);
    const currentSeason = league.currentseason;
    
    if (!currentSeason) {
      console.log('❌ No current season found');
      return;
    }
    
    console.log(`Current Season: ${currentSeason.name} (ID: ${currentSeason.id})`);
    console.log('\n');

    // Step 2: Get standings by season ID
    console.log('📊 Step 2: Fetching standings by season ID...');
    console.log(`Endpoint: /standings/seasons/${currentSeason.id}`);
    
    const standingsResponse = await get(`/standings/seasons/${currentSeason.id}`, {
      include: 'participant'
    });
    
    const standings = standingsResponse.data?.data;
    
    console.log('\n🔍 STANDINGS RESPONSE STRUCTURE:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(standings, null, 2));
    console.log('\n');

    // Step 3: Try to get live standings by league ID
    console.log('⚡ Step 3: Fetching LIVE standings by league ID...');
    console.log(`Endpoint: /standings/live/leagues/${PREMIER_LEAGUE_ID}`);
    
    try {
      const liveStandingsResponse = await get(`/standings/live/leagues/${PREMIER_LEAGUE_ID}`, {
        include: 'participant'
      });
      
      const liveStandings = liveStandingsResponse.data?.data;
      
      console.log('\n🔍 LIVE STANDINGS RESPONSE STRUCTURE:');
      console.log('='.repeat(80));
      console.log(JSON.stringify(liveStandings, null, 2));
      console.log('\n');
    } catch (error) {
      console.log('❌ Live standings endpoint failed:');
      console.log(error.response?.data || error.message);
      console.log('\n');
    }

    // Step 4: Parse and display standings if available
    if (Array.isArray(standings) && standings.length > 0) {
      console.log('📋 PREMIER LEAGUE STANDINGS TABLE:');
      console.log('='.repeat(80));
      
      // Check structure - standings can be nested differently for leagues vs cups
      const firstItem = standings[0];
      console.log('\nFirst item keys:', Object.keys(firstItem));
      
      // For normal leagues, standings usually have a 'details' array
      if (firstItem.details && Array.isArray(firstItem.details)) {
        console.log('\n📊 League format detected (with details array)\n');
        console.log('Pos | Team                          | P  | W  | D  | L  | GF | GA | GD  | Pts');
        console.log('-'.repeat(90));
        
        firstItem.details.forEach(detail => {
          const pos = String(detail.position || '-').padEnd(3);
          const team = String(detail.participant?.name || 'Unknown').padEnd(29);
          const played = String(detail.games_played || 0).padEnd(2);
          const won = String(detail.won || 0).padEnd(2);
          const drawn = String(detail.draw || 0).padEnd(2);
          const lost = String(detail.lost || 0).padEnd(2);
          const gf = String(detail.goals_for || 0).padEnd(2);
          const ga = String(detail.goals_against || 0).padEnd(2);
          const gd = String((detail.goals_for || 0) - (detail.goals_against || 0)).padEnd(3);
          const pts = String(detail.points || 0);
          
          console.log(`${pos} | ${team} | ${played} | ${won} | ${drawn} | ${lost} | ${gf} | ${ga} | ${gd} | ${pts}`);
        });
      } else {
        console.log('\n🏆 Cup/Tournament format detected\n');
        console.log('Full structure:');
        standings.forEach((item, index) => {
          console.log(`\n--- Standing Item ${index + 1} ---`);
          console.log(JSON.stringify(item, null, 2));
        });
      }
    } else {
      console.log('❌ No standings data found or unexpected format');
    }

    console.log('\n');
    console.log('='.repeat(80));
    console.log('✅ STANDINGS CHECK COMPLETE');
    console.log('='.repeat(80));

  } catch (error) {
    console.error('❌ ERROR:', error);
    if (error.response?.data) {
      console.error('Response data:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
})();
