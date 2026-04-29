// Script to get Step 1 (narrative JSON) output for match 19432238
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const { generateReportPipeline } = require('./services/reportPipeline');
const fs = require('fs');
const path = require('path');

async function getStep1Output() {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected');

    const matchId = 19432238;
    
    // First, check if match exists and get team info
    const match = await Match.findOne({ match_id: matchId });
    
    if (!match) {
      console.log(`❌ Match ${matchId} not found in database`);
      return;
    }

    console.log('\n📊 Match Found:');
    console.log(`${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name}`);
    console.log(`Status: ${match.match_status?.name}`);
    console.log('');

    // Determine team slug (try both teams)
    const homeSlug = match.teams?.home?.team_name?.toLowerCase().replace(/ /g, '-');
    const awaySlug = match.teams?.away?.team_name?.toLowerCase().replace(/ /g, '-');
    
    console.log(`Generating report for ${homeSlug}...`);
    console.log('');

    // Try to generate report
    try {
      const result = await generateReportPipeline({
        matchId: matchId,
        teamSlug: homeSlug,
        options: {
          saveInterpretation: true
        }
      });

      console.log('='.repeat(80));
      console.log('STEP 1 OUTPUT: NARRATIVE JSON');
      console.log('='.repeat(80));
      console.log('');
      console.log(JSON.stringify(result.interpretation, null, 2));
      console.log('');
      console.log('='.repeat(80));

      // Save to file
      const outputDir = path.join(__dirname, 'step1-outputs');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `step1_${matchId}_${homeSlug}_${Date.now()}.json`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(result.interpretation, null, 2));
      
      console.log(`\n💾 Step 1 output saved to: ${filepath}`);

    } catch (reportError) {
      console.log(`Failed for ${homeSlug}, trying ${awaySlug}...`);
      
      const result = await generateReportPipeline({
        matchId: matchId,
        teamSlug: awaySlug,
        options: {
          saveInterpretation: true
        }
      });

      console.log('='.repeat(80));
      console.log('STEP 1 OUTPUT: NARRATIVE JSON');
      console.log('='.repeat(80));
      console.log('');
      console.log(JSON.stringify(result.interpretation, null, 2));
      console.log('');
      console.log('='.repeat(80));

      // Save to file
      const outputDir = path.join(__dirname, 'step1-outputs');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filename = `step1_${matchId}_${awaySlug}_${Date.now()}.json`;
      const filepath = path.join(outputDir, filename);
      fs.writeFileSync(filepath, JSON.stringify(result.interpretation, null, 2));
      
      console.log(`\n💾 Step 1 output saved to: ${filepath}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

getStep1Output();
