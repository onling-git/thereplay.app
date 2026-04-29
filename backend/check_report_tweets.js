// Check if newly generated reports have embedded tweets in generated object
require('dotenv').config();
const mongoose = require('mongoose');
const Report = require('./models/Report');

async function checkGeneratedReports() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const matchId = 19432238;
    
    const reports = await Report.find({ match_id: matchId }).lean();
    
    console.log(`Found ${reports.length} reports for match ${matchId}\n`);
    
    reports.forEach((report, i) => {
      console.log(`\n=== REPORT ${i + 1} ===`);
      console.log('ID:', report._id);
      console.log('Team Slug:', report.team_slug);
      console.log('');
      
      console.log('Top-level embedded_tweets:', report.embedded_tweets?.length || 0);
      console.log('generated.embedded_tweets:', report.generated?.embedded_tweets?.length || 0);
      
      if (report.generated?.embedded_tweets && report.generated.embedded_tweets.length > 0) {
        console.log('\n📝 Embedded tweets:');
        report.generated.embedded_tweets.forEach((tweet, j) => {
          console.log(`  [${j + 1}] @${tweet.author.userName}`);
          console.log(`      "${tweet.text.substring(0, 80)}..."`);
        });
      }
      
      console.log('\ngenerated.summary_paragraphs:', report.generated?.summary_paragraphs?.length || 0);
      console.log('generated.key_moments:', report.generated?.key_moments?.length || 0);
    });

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

checkGeneratedReports();
