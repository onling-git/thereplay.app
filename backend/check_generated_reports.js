// Check the generated reports to see if tweets are embedded
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Report = require('./models/Report');

async function main() {
  await mongoose.connect(process.env.DBURI);
  console.log('✅ Connected to MongoDB\n');
  
  const reports = await Report.find({ match_id: { $in: [19432260, 19432257] } })
    .sort({ generated_at: -1 })
    .limit(4);
  
  console.log(`Found ${reports.length} recent reports\n`);
  console.log('='.repeat(80));
  
  reports.forEach((report, i) => {
    console.log(`\nReport ${i + 1}:`);
    console.log(`  Match ID: ${report.match_id}`);
    console.log(`  Team: ${report.team_focus}`);
    console.log(`  Headline: ${report.headline?.substring(0, 60)}...`);
    console.log(`  Generated: ${report.generated_at}`);
    console.log(`  Embedded tweets: ${report.embedded_tweets?.length || 0}`);
    
    if (report.embedded_tweets && report.embedded_tweets.length > 0) {
      console.log('\n  Tweets:');
      report.embedded_tweets.forEach((tweet, j) => {
        console.log(`    ${j + 1}. @${tweet.author?.userName}: ${tweet.text?.substring(0, 60)}...`);
      });
    } else {
      console.log('  ⚠️ No embedded tweets');
    }
    
    console.log('\n  Content preview:');
    console.log(`  ${report.content?.substring(0, 200)}...`);
    console.log('');
    console.log('='.repeat(80));
  });
  
  await mongoose.disconnect();
}

main().catch(console.error);
