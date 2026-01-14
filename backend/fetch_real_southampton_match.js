require('dotenv').config();
const axios = require('axios');

async function fetchRealSouthamptonMatch() {
  try {
    console.log('🔍 Fetching real Southampton matches from SportMonks API...\n');

    const apiKey = process.env.SPORTMONKS_API_KEY;
    if (!apiKey) {
      console.error('❌ SPORTMONKS_API_KEY not found in environment variables');
      return;
    }

    // Southampton team ID is typically 496 in SportMonks (not 65)
    const southamptonTeamId = 496;
    
    // Fetch recent Southampton matches - using simpler includes first
    const url = `https://api.sportmonks.com/v3/football/fixtures?api_token=${apiKey}&include=participants&filter=participantIds:${southamptonTeamId}`;
    
    console.log('API URL:', url);
    
    const response = await axios.get(url);
    const matches = response.data.data;
    
    console.log(`✅ Found ${matches.length} Southampton matches:`);
    
    // Look for matches around January 1st, 2026
    const targetDate = new Date('2026-01-01');
    const januaryMatches = matches.filter(match => {
      const matchDate = new Date(match.starting_at);
      const timeDiff = Math.abs(matchDate - targetDate);
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      return daysDiff <= 7; // Within a week of Jan 1st
    });
    
    console.log(`\n🎯 Matches around January 1st, 2026 (±7 days):`);
    januaryMatches.forEach((match, i) => {
      console.log(`${i + 1}. Match ID: ${match.id}`);
      console.log(`   Date: ${match.starting_at}`);
      console.log(`   Home: ${match.participants[0]?.name} (ID: ${match.participants[0]?.id})`);
      console.log(`   Away: ${match.participants[1]?.name} (ID: ${match.participants[1]?.id})`);
      console.log(`   Score: ${match.scores?.[0]?.score?.goals || 0} - ${match.scores?.[1]?.score?.goals || 0}`);
      console.log(`   State: ${match.state?.name}`);
      console.log(`   Has lineups: ${match.lineups?.length > 0 ? 'Yes' : 'No'}`);
      console.log('');
    });
    
    // Look specifically for Southampton vs Millwall or Millwall vs Southampton
    const southamptonVsMillwall = matches.find(match => {
      const homeTeam = match.participants[0]?.name?.toLowerCase();
      const awayTeam = match.participants[1]?.name?.toLowerCase();
      
      return (homeTeam?.includes('southampton') && awayTeam?.includes('millwall')) ||
             (homeTeam?.includes('millwall') && awayTeam?.includes('southampton'));
    });
    
    if (southamptonVsMillwall) {
      console.log('🎉 Found Southampton vs Millwall match!');
      console.log('Match details:', JSON.stringify(southamptonVsMillwall, null, 2));
      
      // If this match has lineups, show formation data
      if (southamptonVsMillwall.lineups && southamptonVsMillwall.lineups.length > 0) {
        console.log('\n📋 Lineup/Formation data:');
        southamptonVsMillwall.lineups.forEach((lineup, i) => {
          console.log(`Team ${i + 1} lineup:`, lineup);
        });
      }
    } else {
      console.log('❌ No Southampton vs Millwall match found in the fetched data');
      
      // Show all matches for debugging
      console.log('\n📊 All matches for reference:');
      matches.slice(0, 10).forEach((match, i) => {
        console.log(`${i + 1}. ${match.participants[0]?.name} vs ${match.participants[1]?.name} (${match.starting_at})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error fetching real match data:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

fetchRealSouthamptonMatch();