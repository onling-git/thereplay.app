const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');
const Tweet = require('./models/Tweet');
const Report = require('./models/Report');
const { generateReportFor } = require('./controllers/reportController');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

async function testTweetCollectionFix() {
  try {
    await mongoose.connect(connectionString);
    console.log('🔗 Connected to database');

    // Find Southampton team
    const southampton = await Team.findOne({ slug: 'southampton' });
    if (!southampton) {
      console.log('❌ Southampton team not found');
      return;
    }

    console.log(`✅ Found Southampton (ID: ${southampton.id})`);
    console.log(`📱 Twitter enabled: ${southampton.twitter?.tweet_fetch_enabled}`);
    console.log(`🏷️ Hashtag: ${southampton.twitter?.hashtag}`);

    // Find a recent Southampton match
    const recentMatch = await Match.findOne({
      $or: [
        { home_team_id: southampton.id },
        { away_team_id: southampton.id }
      ]
    }).sort({ date: -1 });

    if (!recentMatch) {
      console.log('❌ No Southampton matches found');
      return;
    }

    console.log(`\n🏈 Testing with match: ${recentMatch.match_id}`);
    console.log(`   📅 Date: ${recentMatch.date}`);
    console.log(`   🏟️ ${recentMatch.home_team} vs ${recentMatch.away_team}`);

    // Check current tweet count before report generation
    const tweetsBeforeCount = await Tweet.countDocuments({ team_id: southampton.id });
    console.log(`\n📊 Current tweets for Southampton: ${tweetsBeforeCount}`);

    // Check if tweets exist for this specific match timeframe
    const matchTweets = await Tweet.findForReport(southampton.id, recentMatch.date, {
      preMatchHours: 24,
      postMatchHours: 6,
      limit: 20
    });

    console.log(`🔍 Tweets found for match timeframe: ${matchTweets.length}`);

    // Clear any existing reports for this match/team to test fresh generation
    await Report.deleteMany({ 
      match_id: recentMatch.match_id, 
      team_slug: 'southampton'
    });
    console.log('🗑️ Cleared existing reports for testing');

    // Generate report (this should automatically collect tweets if none exist)
    console.log('\n🚀 Generating report...');
    const report = await generateReportFor(recentMatch.match_id, 'southampton');

    if (report) {
      console.log('\n📄 Report generated successfully!');
      console.log(`   📱 Embedded tweets count: ${report.generated?.embedded_tweets?.length || 0}`);
      
      // Check if tweets were collected during the process
      const tweetsAfterCount = await Tweet.countDocuments({ team_id: southampton.id });
      const newTweets = tweetsAfterCount - tweetsBeforeCount;
      
      if (newTweets > 0) {
        console.log(`🎉 SUCCESS: ${newTweets} new tweets were automatically collected!`);
      } else {
        console.log(`ℹ️ No new tweets collected (already had sufficient tweets or collection failed)`);
      }

      // Show embedded tweets in the report
      if (report.generated?.embedded_tweets?.length > 0) {
        console.log('\n📱 Embedded tweets in report:');
        report.generated.embedded_tweets.forEach((tweet, i) => {
          console.log(`   ${i + 1}. @${tweet.author.userName}: ${tweet.text.substring(0, 60)}...`);
        });
      } else {
        console.log('\n❌ No embedded tweets found in report');
      }

      // Check if AI properly avoided fabrication when no tweets were available
      const summaryText = report.generated?.summary_paragraphs?.join(' ') || '';
      const commentaryText = report.generated?.commentary?.join(' ') || '';
      const combinedText = (summaryText + ' ' + commentaryText).toLowerCase();
      
      const fabricationIndicators = ['social media', 'twitter', 'fans on social media', 'reporter', 'observed on'];
      const hasPotentialFabrication = fabricationIndicators.some(indicator => 
        combinedText.includes(indicator) && report.generated?.embedded_tweets?.length === 0
      );

      if (hasPotentialFabrication) {
        console.log('⚠️  WARNING: Report may contain fabricated social media references');
      } else {
        console.log('✅ AI correctly avoided fabricating social media references');
      }

    } else {
      console.log('❌ Report generation failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    mongoose.disconnect();
  }
}

testTweetCollectionFix();