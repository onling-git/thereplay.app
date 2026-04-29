// One-off script to regenerate reports for matches that failed over the weekend
// Match IDs: 19432260 and 19432257
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const { generateBothReports } = require('./controllers/reportController');

const MATCH_IDS = [19432260, 19432257];

async function main() {
  console.log('🔄 Regenerating weekend reports...\n');
  
  await mongoose.connect(process.env.MONGO_URI || process.env.DBURI, { 
    dbName: process.env.DBNAME || undefined 
  });
  console.log('✅ Connected to MongoDB\n');

  let successCount = 0;
  let failCount = 0;

  for (const matchId of MATCH_IDS) {
    console.log('='.repeat(80));
    console.log(`📋 Processing Match ID: ${matchId}`);
    console.log('='.repeat(80));

    try {
      const reports = await generateBothReports(Number(matchId));
      console.log(`✅ Generated ${reports.length} reports for match ${matchId}`);
      reports.forEach(r => {
        console.log(`   - Team: ${r.team_focus}, MOTM: ${r.man_of_the_match || 'N/A'}`);
      });
      successCount++;
    } catch (e) {
      console.error(`❌ Failed to generate reports for match ${matchId}:`, e.message || e);
      failCount++;
    }
    
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total matches processed: ${MATCH_IDS.length}`);
  console.log(`✅ Successful: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  
  await mongoose.disconnect();
  console.log('\n✅ Disconnected from MongoDB');
}

main().catch(e => { 
  console.error('Fatal error:', e); 
  process.exit(1); 
});
