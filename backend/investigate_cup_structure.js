require('dotenv').config();
const sportmonks = require('./utils/sportmonks');

async function investigateCupStructure() {
  try {
    // Let's check FA Cup (ID: 24) as an example
    const cupId = 24;
    
    console.log('🏆 Investigating Cup Competition Structure\n');
    console.log('='.repeat(80));
    
    // 1. Get cup with current season
    console.log('\n1. Fetching FA Cup with current season...\n');
    const cupResponse = await sportmonks.get(`/leagues/${cupId}`, {
      include: 'currentseason'
    });
    const cup = cupResponse.data?.data;
    console.log(`Cup: ${cup.name} (${cup.type}, ${cup.sub_type})`);
    console.log(`Current Season: ${cup.currentseason?.name} (ID: ${cup.currentseason?.id})`);
    
    const seasonId = cup.currentseason?.id;
    
    // 2. Get stages for this season
    console.log('\n2. Fetching stages/rounds for the season...\n');
    const stagesResponse = await sportmonks.get(`/stages/seasons/${seasonId}`);
    const stages = stagesResponse.data?.data || [];
    console.log(`Found ${stages.length} stages:\n`);
    stages.forEach(stage => {
      console.log(`   - ${stage.name} (ID: ${stage.id})${stage.type_id ? ` [type: ${stage.type_id}]` : ''}`);
    });
    
    // 3. Get specific stage details with includes
    if (stages.length > 0) {
      const finalStage = stages.find(s => s.name.includes('Final')) || stages[0];
      console.log(`\n3. Fetching detailed info for stage: ${finalStage.name}...\n`);
      try {
        const stageDetailResponse = await sportmonks.get(`/stages/${finalStage.id}`, {
          include: 'fixtures'
        });
        const stageDetail = stageDetailResponse.data?.data;
        const fixtures = stageDetail?.fixtures || [];
        console.log(`Found ${fixtures.length} fixtures in this stage:\n`);
        fixtures.slice(0, 10).forEach(fixture => {
          const team1 = fixture.participants?.[0]?.name || fixture.localteam_id;
          const team2 = fixture.participants?.[1]?.name || fixture.visitorteam_id;
          const score = fixture.scores?.[6]?.score; // Full time score
          console.log(`   - ${team1} vs ${team2} ${score ? `[${score.goals.localteam}-${score.goals.visitorteam}]` : '[Not played]'}`);
        });
      } catch (e) {
        console.log('Could not fetch stage details:', e.message);
      }
    }
    
    // 4. Check if there's bracket/progression data
    console.log('\n4. Checking for bracket/aggregated data...\n');
    try {
      const aggregatedResponse = await sportmonks.get(`/stages/seasons/${seasonId}`, {
        include: 'fixtures,participants'
      });
      console.log('Sample stage with includes:', JSON.stringify(aggregatedResponse.data?.data?.[0], null, 2).substring(0, 1000));
    } catch (e) {
      console.log('Could not fetch aggregated data:', e.message);
    }
    
    console.log('\n' + '='.repeat(80));
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

investigateCupStructure();
