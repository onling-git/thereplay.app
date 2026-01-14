// Manual FA Cup Match Report Generator - Liverpool vs Barnsley (19615693)
require('dotenv').config();
const mongoose = require('mongoose');
const { generateBothReports } = require('./controllers/reportController');

async function generateFACupReport() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    console.log('📊 Connected to database');

    const matchId = 19615693;
    console.log(`🏆 Generating FA Cup match report for Liverpool vs Barnsley (ID: ${matchId})`);
    
    // Generate both home and away reports
    const reports = await generateBothReports(matchId);
    
    if (reports && reports.length > 0) {
      console.log(`✅ Successfully generated ${reports.length} report(s):`);
      reports.forEach((report, index) => {
        console.log(`   ${index + 1}. ${report.teamSlug} - ${report.headline}`);
      });
      
      console.log(`\n🔗 View the report at: http://localhost:3000/liverpool/match/${matchId}/report`);
    } else {
      console.log('❌ No reports were generated');
    }

  } catch (error) {
    console.error('❌ Error generating FA Cup report:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('📊 Disconnected from database');
  }
}

generateFACupReport();