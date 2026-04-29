// Simple script to check if report exists for match 19432238
require('dotenv').config();
const mongoose = require('mongoose');
const Report = require('./models/Report');

async function checkReport() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    const matchId = 19432238;
    
    const reports = await Report.find({ match_id: matchId });
    
    console.log(`\n📊 Found ${reports.length} report(s) for match ${matchId}`);
    
    if (reports.length > 0) {
      reports.forEach((report, index) => {
        console.log(`\n--- Report ${index + 1} ---`);
        console.log('Team:', report.team_slug);
        console.log('Generated:', report.generated_at);
        console.log('Headline:', report.headline);
        
        // Check if interpretation (Step 1) data exists
        if (report.meta?.pipeline?.interpretation) {
          console.log('\n✅ Step 1 (Interpretation) data found!');
          console.log('Interpretation:', JSON.stringify(report.meta.pipeline.interpretation, null, 2));
        } else if (report.interpretation) {
          console.log('\n✅ Step 1 (Interpretation) data found in separate field!');
          console.log('Interpretation:', JSON.stringify(report.interpretation, null, 2));
        } else {
          console.log('\n⚠️ No Step 1 interpretation data in this report');
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkReport();
