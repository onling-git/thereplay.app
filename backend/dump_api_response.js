// Just dump the raw API response to see the exact structure
require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

async function dumpApiResponse() {
  const matchId = 19432044;
  const url = `https://api.sportmonks.com/v3/football/fixtures/${matchId}?api_token=o02EpD6kCh7HWuCN2GDzCMGPOyiXXtt6eLXyOfVmLFTvEQr0gHyTj8ZEX2cJ&include=state;lineups.details;comments;scores;coaches;venue;events;periods;participants;referees;formations;stage`;
  
  console.log('🔍 Fetching raw API response...');
  
  const response = await axios.get(url);
  const data = response.data;
  
  // Save to file for detailed inspection
  fs.writeFileSync('api_response_raw.json', JSON.stringify(data, null, 2));
  console.log('✅ Raw API response saved to api_response_raw.json');
  
  // Show just the keys at the top level
  console.log('\n📊 TOP LEVEL STRUCTURE:');
  console.log('Keys in response:', Object.keys(data));
  console.log('Keys in response.data:', Object.keys(data.data || {}));
  
  // Show just lineup structure
  if (data.data && data.data.lineups) {
    console.log('\n📋 LINEUP STRUCTURE:');
    console.log(`Total lineups: ${data.data.lineups.length}`);
    
    // Show first lineup structure
    if (data.data.lineups.length > 0) {
      const firstLineup = data.data.lineups[0];
      console.log('\nFirst lineup keys:', Object.keys(firstLineup));
      
      if (firstLineup.details && firstLineup.details.length > 0) {
        console.log('First lineup detail keys:', Object.keys(firstLineup.details[0]));
        
        // Show actual first player
        const firstPlayer = firstLineup.details[0];
        console.log('\nFirst player data sample:');
        console.log(JSON.stringify(firstPlayer, null, 2));
      }
    }
  }
  
  // Show participant structure
  if (data.data && data.data.participants) {
    console.log('\n👥 PARTICIPANTS STRUCTURE:');
    console.log(`Total participants: ${data.data.participants.length}`);
    if (data.data.participants.length > 0) {
      console.log('First participant:');
      console.log(JSON.stringify(data.data.participants[0], null, 2));
    }
  }
}

dumpApiResponse().catch(console.error);