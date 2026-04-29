// Check one detailed report to see content quality
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const Report = require('./models/Report');

async function main() {
  await mongoose.connect(process.env.DBURI);
  
  const southamptonReport = await Report.findOne({ 
    match_id: 19432260,
    team_id: 65  // Southampton
  }).lean();
  
  if (!southamptonReport) {
    console.log('❌ Report not found');
    return;
  }
  
  console.log('='.repeat(80));
  console.log('SOUTHAMPTON REPORT - Match 19432260');
  console.log('='.repeat(80));
  console.log('\n📰 HEADLINE:');
  console.log(southamptonReport.headline);
  
  console.log('\n📝 SUMMARY PARAGRAPHS:');
  if (southamptonReport.summary_paragraphs && southamptonReport.summary_paragraphs.length > 0) {
    southamptonReport.summary_paragraphs.forEach((para, i) => {
      console.log(`\n[${i + 1}] ${para}`);
    });
  } else {
    console.log('(None)');
  }
  
  console.log('\n⚡ KEY MOMENTS:');
  if (southamptonReport.key_moments && southamptonReport.key_moments.length > 0) {
    southamptonReport.key_moments.forEach((moment, i) => {
      console.log(`\n[${i + 1}] ${moment}`);
    });
  } else {
    console.log('(None)');
  }
  
  console.log('\n💬 COMMENTARY:');
  if (southamptonReport.commentary && southamptonReport.commentary.length > 0) {
    southamptonReport.commentary.forEach((comment, i) => {
      console.log(`\n[${i + 1}] ${comment}`);
    });
  } else {
    console.log('(None)');
  }
  
  console.log('\n🏆 PLAYER OF THE MATCH:');
  if (southamptonReport.player_of_the_match) {
    const potm = southamptonReport.player_of_the_match;
    console.log(`${potm.player} (${potm.rating}) - ${potm.reason || 'No reason provided'}`);
  } else {
    console.log('(None)');
  }
  
  console.log('\n🐦 EMBEDDED TWEETS:', southamptonReport.embedded_tweets?.length || 0);
  if (southamptonReport.embedded_tweets && southamptonReport.embedded_tweets.length > 0) {
    southamptonReport.embedded_tweets.forEach((tweet, i) => {
      console.log(`\n[${i + 1}] @${tweet.author?.userName}: ${tweet.text?.substring(0, 80)}...`);
    });
  }
  
  console.log('\n📏 CONTENT LENGTH:');
  console.log(`  Headline: ${southamptonReport.headline?.length || 0} chars`);
  console.log(`  Summary paragraphs: ${southamptonReport.summary_paragraphs?.length || 0}`);
  console.log(`  Key moments: ${southamptonReport.key_moments?.length || 0}`);
  console.log(`  Commentary: ${southamptonReport.commentary?.length || 0}`);
  
  console.log('\n' + '='.repeat(80));
  
  await mongoose.disconnect();
}

main().catch(console.error);
