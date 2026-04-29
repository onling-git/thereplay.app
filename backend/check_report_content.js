require('dotenv').config();
const mongoose = require('mongoose');
const Report = require('./models/Report');

async function checkReportContent() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    
    const reports = await Report.find({ match_id: 19631550 }).lean();
    console.log('Found', reports.length, 'reports\n');
    
    for (const report of reports) {
      console.log(`=== REPORT FOR ${report.team_slug.toUpperCase()} ===`);
      console.log('Summary paragraphs:');
      (report.content.summary_paragraphs || []).forEach((para, i) => {
        console.log(`${i+1}. ${para}`);
      });
      
      console.log('\nCommentary:');
      (report.content.commentary || []).forEach((comment, i) => {
        console.log(`${i+1}. ${comment}`);
      });
      
      // Check for problematic league position mentions
      const fullText = JSON.stringify(report.content).toLowerCase();
      const hasLeaguePosition = fullText.includes('league position') || 
                               fullText.includes('position in the league') || 
                               fullText.includes('league table') ||
                               fullText.includes('league standings');
      
      console.log('\n🔍 Contains league position mentions:', hasLeaguePosition);
      
      if (hasLeaguePosition) {
        console.log('⚠️ PROBLEMATIC CONTENT DETECTED');
        const mentions = [];
        if (fullText.includes('league position')) mentions.push('league position');
        if (fullText.includes('position in the league')) mentions.push('position in the league');
        if (fullText.includes('league table')) mentions.push('league table');
        if (fullText.includes('league standings')) mentions.push('league standings');
        console.log('Found mentions:', mentions.join(', '));
      } else {
        console.log('✅ No problematic league mentions found');
      }
      
      console.log('\n' + '='.repeat(50) + '\n');
    }
    
    mongoose.disconnect();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkReportContent();