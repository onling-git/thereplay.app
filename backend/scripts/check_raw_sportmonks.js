// Check raw Sportmonks API response for Southampton match
require('dotenv').config();
const axios = require('axios');

async function checkRawAPI() {
  const matchId = 19432224;
  const apiToken = process.env.SPORTMONKS_API_KEY;
  const baseURL = 'https://api.sportmonks.com/v3/football';
  
  // Try the include that should have ratings (via lineups.details, NOT rates)
  const include = 'lineups.player;lineups.details;formations;events;participants;periods;comments;scores;state';
  
  console.log(`Fetching match ${matchId} from Sportmonks...`);
  console.log(`Include: ${include}\n`);
  
  try {
    const response = await axios.get(`${baseURL}/fixtures/${matchId}`, {
      params: {
        api_token: apiToken,
        include: include
      }
    });
    
    const fixture = response.data?.data;
    
    if (!fixture) {
      console.log('❌ No fixture data returned');
      return;
    }
    
    console.log('✅ Fixture fetched successfully');
    console.log('Home:', fixture.participants?.find(p => p.meta?.location === 'home')?.name || fixture.home_team?.name);
    console.log('Away:', fixture.participants?.find(p => p.meta?.location === 'away')?.name || fixture.away_team?.name);
    console.log('Score:', fixture.scores);
    
    // Check for rates data
    console.log('\n=== CHECKING FOR RATES ===');
    if (fixture.rates) {
      console.log('✅ fixture.rates EXISTS');
      console.log('Type:', Array.isArray(fixture.rates) ? 'Array' : typeof fixture.rates);
      if (fixture.rates.data) {
        console.log(`✅ fixture.rates.data has ${fixture.rates.data.length} items`);
        if (fixture.rates.data.length > 0) {
          console.log('Sample rating:', fixture.rates.data[0]);
        }
      } else if (Array.isArray(fixture.rates)) {
        console.log(`fixture.rates is array with ${fixture.rates.length} items`);
      }
    } else {
      console.log('❌ fixture.rates NOT PRESENT');
    }
    
    // Check for lineups.details with type_id 118
    console.log('\n=== CHECKING FOR LINEUPS.DETAILS (type_id: 118) ===');
    if (fixture.lineups) {
      const lineups = fixture.lineups.data || fixture.lineups;
      console.log(`✅ Found ${lineups.length} lineup groups`);
      
      // Show structure of first lineup entry
      if (lineups.length > 0) {
        console.log('\n=== FIRST LINEUP ENTRY STRUCTURE ===');
        const first = lineups[0];
        console.log('Keys:', Object.keys(first));
        console.log('Player name field:', first.player_name || first.player?.name || 'NOT FOUND');
        console.log('Player ID:', first.player_id);
        console.log('Details count:', (first.details?.data || first.details || []).length);
        if ((first.details?.data || first.details || []).length > 0) {
          const firstDetail = (first.details?.data || first.details)[0];
          console.log('First detail keys:', Object.keys(firstDetail));
          console.log('First detail:', firstDetail);
        }
      }
      
      let ratingsCount = 0;
      for (const lineup of lineups) {
        const details = lineup.details?.data || lineup.details || [];
        const ratingDetails = details.filter(d => d.type_id === 118 || d.type?.id === 118);
        ratingsCount += ratingDetails.length;
        
        if (ratingDetails.length > 0 && ratingsCount <= 3) {
          console.log(`\n  Lineup: ${lineup.player_name || lineup.player?.name} (ID: ${lineup.player_id})`);
          console.log(`  Rating detail:`, ratingDetails[0]);
        }
      }
      
      if (ratingsCount === 0) {
        console.log('❌ NO ratings found in lineup.details (type_id: 118)');
      } else {
        console.log(`\n✅ Total ratings in lineups.details: ${ratingsCount}`);
      }
    } else {
      console.log('❌ fixture.lineups NOT PRESENT');
    }
    
    // Show what includes are actually in the response
    console.log('\n=== AVAILABLE TOP-LEVEL KEYS ===');
    console.log(Object.keys(fixture).sort());
    
  } catch (error) {
    console.error('❌ API ERROR:', error.response?.data || error.message);
  }
}

checkRawAPI();
