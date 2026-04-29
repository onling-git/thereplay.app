require('dotenv').config();
const { get } = require('./utils/sportmonks');

async function fetchMatchFromAPI() {
  try {
    const matchId = 19432238;
    console.log(`🔍 Fetching match ${matchId} from SportMonks API...`);
    
    const response = await get(`fixtures/${matchId}`, {
      include: 'state;participants;scores;venue;events;stage'
    });
    
    const data = response.data.data;
    
    console.log('\n📊 API Match Data:');
    console.log('Match ID:', data.id);
    console.log('Match Name:', data.name);
    
    // Parse participants
    const homeTeam = data.participants?.find(p => p.meta?.location === 'home');
    const awayTeam = data.participants?.find(p => p.meta?.location === 'away');
    
    console.log('\n👥 Teams:');
    console.log('Home:', homeTeam?.name);
    console.log('Away:', awayTeam?.name);
    
    console.log('\n⏰ Time Information from API:');
    console.log('starting_at:', data.starting_at);
    console.log('starting_at_timestamp:', data.starting_at_timestamp);
    
    if (data.starting_at_timestamp) {
      const timestamp = data.starting_at_timestamp;
      const date = new Date(timestamp * 1000);
      console.log('\nTimestamp converts to:');
      console.log('  UTC:', date.toUTCString());
      console.log('  Local:', date.toLocaleString());
      console.log('  ISO:', date.toISOString());
      
      // Calculate what day it is
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const matchDay = date.toDateString();
      const todayStr = now.toDateString();
      const tomorrowStr = tomorrow.toDateString();
      
      if (matchDay === todayStr) {
        console.log('  → This is TODAY');
      } else if (matchDay === tomorrowStr) {
        console.log('  → This is TOMORROW');
      } else {
        console.log(`  → This is ${matchDay}`);
      }
    }
    
    if (data.starting_at) {
      const date = new Date(data.starting_at);
      console.log('\nstarting_at converts to:');
      console.log('  UTC:', date.toUTCString());
      console.log('  Local:', date.toLocaleString());
      console.log('  ISO:', date.toISOString());
    }
    
    console.log('\n🏆 Competition:');
    console.log('League ID:', data.league_id);
    console.log('Stage:', data.stage?.name);
    
    console.log('\n📍 Status:');
    console.log('State:', data.state?.state, `(${data.state?.short_name})`);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

fetchMatchFromAPI();
