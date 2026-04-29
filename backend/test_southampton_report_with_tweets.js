require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');
const Report = require('./models/Report');
const reportPipeline = require('./services/reportPipeline');

const MATCH_ID = 19432238;

async function testSouthamptonReport() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    const match = await Match.findOne({ match_id: MATCH_ID });
    if (!match) {
      console.log('❌ Match not found');
      return;
    }

    console.log('Match fields:', Object.keys(match.toObject()));
    console.log('Match ID:', match.match_id);
    console.log('Teams:', match.teams);

    const awayTeamId = match.teams?.away?.team_id || match.away_team_id;
    const awayTeam = await Team.findOne({ id: awayTeamId }).lean();
    
    console.log(`📋 Match: ${match.teams.home.name} vs ${match.teams.away.name}`);
    console.log(`Generating report for: ${awayTeam.name} (away)\n`);

    // Generate Southampton report with auto tweet collection
    const report = await reportPipeline.generateReportPipeline(
      match,
      awayTeam,
      'away',
      {
        autoCollectTweets: false, // Tweets already collected
        skipSaving: false
      }
    );

    console.log('\n=== SELECTED TWEETS FROM STEP 1 ===');
    console.log(JSON.stringify(report.data.interpretation?.selected_tweets, null, 2));

    console.log('\n=== EMBEDDED TWEETS FOR FRONTEND ===');
    console.log(`Count: ${report.data.generated?.embedded_tweets?.length || 0}`);
    if (report.data.generated?.embedded_tweets) {
      report.data.generated.embedded_tweets.forEach((t, i) => {
        console.log(`\nTweet ${i + 1}:`);
        console.log(`  Author: @${t.author.userName}`);
        console.log(`  Text: ${t.text.substring(0, 80)}...`);
        console.log(`  Context: ${t.embed_context}`);
      });
    }

    console.log('\n=== SUMMARY PARAGRAPHS (checking tweet integration) ===');
    if (report.data.generated?.summary_paragraphs) {
      report.data.generated.summary_paragraphs.forEach((p, i) => {
        console.log(`\nParagraph ${i + 1}:`);
        console.log(p);
      });
    }

    console.log('\n✅ Report generated successfully!');
    console.log(`Report ID: ${report._id}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testSouthamptonReport();
