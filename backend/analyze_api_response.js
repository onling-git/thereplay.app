// Analyze the exact API response structure
require('dotenv').config();
const axios = require('axios');

async function analyzeApiResponse() {
  const matchId = 19432044;
  const url = `https://api.sportmonks.com/v3/football/fixtures/${matchId}?api_token=o02EpD6kCh7HWuCN2GDzCMGPOyiXXtt6eLXyOfVmLFTvEQr0gHyTj8ZEX2cJ&include=state;lineups.details;comments;scores;coaches;venue;events;periods;participants;referees;formations`;
  
  console.log('🔍 Fetching API response to analyze structure...');
  
  const response = await axios.get(url);
  const data = response.data.data;
  
  console.log('\n📊 API RESPONSE ANALYSIS:');
  console.log('='.repeat(50));
  
  // Basic match info
  console.log(`Match ID: ${data.id}`);
  console.log(`Starting at: ${data.starting_at}`);
  console.log(`State: ${data.state?.state} (${data.state?.name})`);
  
  // Participants
  console.log('\n👥 PARTICIPANTS:');
  if (data.participants) {
    data.participants.forEach((p, i) => {
      console.log(`  ${i+1}. ${p.name} (ID: ${p.id}, Location: ${p.meta?.location})`);
    });
  }
  
  // Scores
  console.log('\n⚽ SCORES:');
  if (data.scores) {
    data.scores.forEach(score => {
      const participant = data.participants?.find(p => p.id === score.participant_id);
      console.log(`  ${participant?.name}: ${score.score?.goals || 0} goals`);
    });
  }
  
  // Lineups - This is the key part!
  console.log('\n📋 LINEUPS STRUCTURE:');
  console.log(`Total lineups array length: ${data.lineups?.length || 0}`);
  
  if (data.lineups && data.lineups.length > 0) {
    data.lineups.forEach((lineup, i) => {
      const participant = data.participants?.find(p => p.id === lineup.participant_id);
      console.log(`\n  Lineup ${i+1}:`);
      console.log(`    Participant: ${participant?.name} (ID: ${lineup.participant_id})`);
      console.log(`    Details count: ${lineup.details?.length || 0}`);
      
      if (lineup.details && lineup.details.length > 0) {
        // Show first 5 players as sample
        console.log(`    Sample players:`);
        lineup.details.slice(0, 5).forEach((detail, j) => {
          console.log(`      ${j+1}. ${detail.player?.display_name || detail.player?.common_name}`);
          console.log(`         Jersey: ${detail.jersey_number}`);
          console.log(`         Position ID: ${detail.position_id}`);
          console.log(`         Formation position: ${detail.formation_position}`);
          console.log(`         Formation field: ${detail.formation_field}`);
          console.log(`         Type: ${detail.type}`);
          console.log(`         ---`);
        });
        
        // Count formation data
        const withFormationField = lineup.details.filter(d => d.formation_field).length;
        const withFormationPosition = lineup.details.filter(d => d.formation_position).length;
        const startingXI = lineup.details.filter(d => d.type === 'STARTING_XI').length;
        const substitutes = lineup.details.filter(d => d.type === 'SUBSTITUTE').length;
        
        console.log(`    Formation analysis:`);
        console.log(`      With formation_field: ${withFormationField}`);
        console.log(`      With formation_position: ${withFormationPosition}`);
        console.log(`      Starting XI: ${startingXI}`);
        console.log(`      Substitutes: ${substitutes}`);
      }
    });
  }
  
  // Events
  console.log('\n⚡ EVENTS:');
  console.log(`Total events: ${data.events?.length || 0}`);
  if (data.events && data.events.length > 0) {
    console.log('First 3 events:');
    data.events.slice(0, 3).forEach((event, i) => {
      console.log(`  ${i+1}. Min ${event.minute}: ${event.type?.type} - ${event.player?.display_name || 'N/A'}`);
    });
  }
  
  // Comments
  console.log('\n💬 COMMENTS:');
  console.log(`Total comments: ${data.comments?.length || 0}`);
  if (data.comments && data.comments.length > 0) {
    const goalComments = data.comments.filter(c => c.is_goal).length;
    const importantComments = data.comments.filter(c => c.is_important).length;
    console.log(`Goal comments: ${goalComments}`);
    console.log(`Important comments: ${importantComments}`);
  }
}

analyzeApiResponse().catch(console.error);