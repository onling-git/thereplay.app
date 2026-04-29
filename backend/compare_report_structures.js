// Compare report structures
const mongoose = require('mongoose');
require('dotenv').config();

const Report = require('./models/Report');

async function compareReports() {
  try {
    await mongoose.connect(process.env.DBURI);
    console.log('Connected to MongoDB');
    
    // Get old report (19432238)
    const oldReport = await Report.findOne({ match_id: 19432238, team_slug: 'southampton' }).lean();
    
    // Get new report (19432248)
    const newReport = await Report.findOne({ match_id: 19432248, team_slug: 'southampton' }).lean();
    
    console.log('\n=== OLD REPORT (19432238) ===');
    console.log(`Summary paragraphs: ${oldReport?.summary_paragraphs?.length || 0}`);
    console.log(`Total words in summary: ${oldReport?.summary_paragraphs?.join(' ').split(' ').length || 0}`);
    console.log(`Commentary paragraphs: ${oldReport?.commentary?.length || 0}`);
    console.log(`Key moments: ${oldReport?.key_moments?.length || 0}`);
    console.log(`Embedded tweets: ${oldReport?.embedded_tweets?.length || 0}`);
    console.log(`Pipeline version: ${oldReport?.meta?.pipeline?.version || 'undefined'}`);
    
    console.log('\n=== NEW REPORT (19432248) ===');
    console.log(`Summary paragraphs: ${newReport?.summary_paragraphs?.length || 0}`);
    console.log(`Total words in summary: ${newReport?.summary_paragraphs?.join(' ').split(' ').length || 0}`);
    console.log(`Commentary paragraphs: ${newReport?.commentary?.length || 0}`);
    console.log(`Key moments: ${newReport?.key_moments?.length || 0}`);
    console.log(`Embedded tweets: ${newReport?.embedded_tweets?.length || 0}`);
    console.log(`Pipeline version: ${newReport?.meta?.pipeline?.version || 'undefined'}`);
    
    if (oldReport) {
      console.log('\n=== OLD REPORT FIRST PARAGRAPH ===');
      console.log(oldReport.summary_paragraphs[0]?.substring(0, 300) + '...');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

compareReports();
