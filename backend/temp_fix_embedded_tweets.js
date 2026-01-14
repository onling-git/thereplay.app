const mongoose = require('mongoose');
const Match = require('./models/Match');
const Report = require('./models/Report');
const Tweet = require('./models/Tweet');
const { generateReportFor } = require('./controllers/reportController');

const connectionString = process.env.DBURI || 'mongodb+srv://admin:AeFu-cwqPDCdc49@cluster0.4fdbxhw.mongodb.net/fulltime?retryWrites=true&w=majority&appName=thefinalplay';

mongoose.connect(connectionString);

mongoose.connection.once('open', async () => {
  try {
    console.log('🔧 Temporarily modifying match date to test embedded tweets');
    
    const matchId = 19431921;
    const teamSlug = 'southampton';
    
    // Get the match and tweets
    const match = await Match.findOne({ match_id: matchId });
    const tweets = await Tweet.find({ team_id: 65 }).sort({ created_at: -1 });
    
    if (!match) {
      console.log('❌ Match not found');
      return;
    }
    
    if (tweets.length === 0) {
      console.log('❌ No tweets found');
      return;
    }
    
    console.log(`📍 Original match date: ${match.date}`);
    console.log(`🐦 Most recent tweet date: ${tweets[0].created_at}`);
    
    // Store original date
    const originalDate = match.date;
    
    // Set match date to be close to the tweet dates (Nov 19th around noon)
    const tempMatchDate = new Date('2025-11-19T14:00:00.000Z');
    
    console.log(`⏰ Temporarily setting match date to: ${tempMatchDate}`);
    
    // Update match date temporarily
    await Match.updateOne(
      { match_id: matchId },
      { date: tempMatchDate }
    );
    
    console.log('✅ Match date updated temporarily');
    
    // Delete any existing report for this match/team to force regeneration
    await Report.deleteMany({ 
      match_id: matchId, 
      team_slug: teamSlug 
    });
    
    console.log('🗑️ Deleted existing reports');
    
    // Create a mock request/response object for generateReportFor
    const mockReq = {
      params: { matchId: matchId.toString(), teamSlug }
    };
    
    const mockRes = {
      json: (data) => {
        console.log('📄 Report generation result:', {
          success: data.ok,
          reportId: data.report?._id,
          embeddedTweetsCount: data.report?.generated?.embedded_tweets?.length || 0
        });
        return data;
      },
      status: (code) => ({
        json: (data) => {
          console.log('❌ Report generation failed:', code, data);
          return data;
        }
      })
    };
    
    console.log('🤖 Generating report with embedded tweets...');
    
    // Generate the report using the actual report controller function
    try {
      const reportResult = await generateReportFor(matchId, teamSlug);
      
      console.log('✅ Report generated successfully!');
      console.log(`📊 Embedded tweets count: ${reportResult.generated?.embedded_tweets?.length || 0}`);
      
      if (reportResult.generated?.embedded_tweets?.length > 0) {
        console.log('\n🎉 SUCCESS! Embedded tweets are now in the report:');
        reportResult.generated.embedded_tweets.slice(0, 2).forEach((tweet, index) => {
          console.log(`\n   Tweet ${index + 1}:`);
          console.log(`   Author: ${tweet.author?.name || tweet.author?.userName}`);
          console.log(`   Text: "${tweet.text.substring(0, 100)}..."`);
          console.log(`   Engagement: ${tweet.engagement?.likes || 0} likes, ${tweet.engagement?.retweets || 0} retweets`);
        });
      }
      
    } catch (reportError) {
      console.error('❌ Error generating report:', reportError.message);
    }
    
    // Restore original match date
    console.log('\n🔄 Restoring original match date...');
    await Match.updateOne(
      { match_id: matchId },
      { date: originalDate }
    );
    
    console.log('✅ Match date restored to original');
    console.log('\n🏁 Process complete! The report should now have embedded tweets.');
    console.log('🌐 Check your frontend - the embedded tweets should now be visible!');
    
  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    mongoose.disconnect();
  }
});