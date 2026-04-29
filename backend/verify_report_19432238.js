// Verify report exists in database
require('dotenv').config();
const mongoose = require('mongoose');
const Report = require('./models/Report');

async function verifyReport() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB');

    const matchId = 19432238;
    
    console.log(`\n🔍 Searching for reports with match_id: ${matchId}`);
    
    const reports = await Report.find({ match_id: matchId });
    
    console.log(`\nFound ${reports.length} report(s)\n`);
    
    if (reports.length === 0) {
      console.log('❌ No reports found for this match');
      
      // Try searching by the ObjectId
      const reportById = await Report.findById('69d62471a21f3cdbef028fbe');
      if (reportById) {
        console.log('\n✅ Found report by ObjectId:');
        console.log(JSON.stringify(reportById, null, 2));
      } else {
        console.log('\n❌ Report not found by ObjectId either');
      }
    } else {
      reports.forEach((report, i) => {
        console.log(`\n=== REPORT ${i + 1} ===`);
        console.log('ID:', report._id);
        console.log('Match ID:', report.match_id);
        console.log('Team ID:', report.team_id);
        console.log('Team Slug:', report.team_slug);
        console.log('Headline:', report.headline);
        console.log('Summary Paragraphs:', report.summary_paragraphs?.length || 0);
        console.log('Key Moments:', report.key_moments?.length || 0);
        console.log('Generated At:', report.generated_at);
        console.log('Updated At:', report.updated_at);
        console.log('\n--- FULL DOCUMENT ---');
        console.log(JSON.stringify(report, null, 2));
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
  }
}

verifyReport();
