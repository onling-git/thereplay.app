// Check if NEW report has generated.* fields
const mongoose = require('mongoose');
require('dotenv').config();

const Report = require('./models/Report');

async function checkNewReportFields() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to MongoDB');
    
    const newReport = await Report.findOne({ match_id: 19432248, team_slug: 'southampton' }).lean();
    
    if (!newReport) {
      console.log('No report found');
      return;
    }
    
    console.log('\n=== NEW REPORT (19432248) FIELDS ===\n');
    
    // Check top-level fields
    console.log('Top-level fields:');
    console.log(`  summary_paragraphs: Array(${newReport.summary_paragraphs?.length || 0})`);
    console.log(`  commentary: Array(${newReport.commentary?.length || 0})`);
    console.log(`  key_moments: Array(${newReport.key_moments?.length || 0})`);
    console.log(`  embedded_tweets: Array(${newReport.embedded_tweets?.length || 0})`);
    console.log(`  sources: Array(${newReport.sources?.length || 0})`);
    
    // Check generated.* fields
    if (newReport.generated) {
      console.log('\n✅ generated.* fields exist:');
      console.log(`  generated.summary_paragraphs: Array(${newReport.generated.summary_paragraphs?.length || 0})`);
      console.log(`  generated.commentary: Array(${newReport.generated.commentary?.length || 0})`);
      console.log(`  generated.key_moments: Array(${newReport.generated.key_moments?.length || 0})`);
      console.log(`  generated.embedded_tweets: Array(${newReport.generated.embedded_tweets?.length || 0})`);
      console.log(`  generated.sources: Array(${newReport.generated.sources?.length || 0})`);
      
      // Show first paragraph from generated
      if (newReport.generated.summary_paragraphs?.length > 0) {
        console.log('\n=== generated.summary_paragraphs[0] ===');
        console.log(newReport.generated.summary_paragraphs[0].substring(0, 200) + '...');
      }
      
      // Show commentary
      if (newReport.generated.commentary?.length > 0) {
        console.log('\n=== generated.commentary[0] ===');
        console.log(newReport.generated.commentary[0].substring(0, 200) + '...');
      }
    } else {
      console.log('\n❌ No generated.* fields - backend compatibility NOT working!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

checkNewReportFields();
