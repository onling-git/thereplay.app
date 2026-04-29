// One-off script to regenerate Southampton report for match 19432105
// This will incorporate the newly collected tweets into the AI-generated report

require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');
const Team = require('./models/Team');
const Report = require('./models/Report');
const { generateReportFor } = require('./controllers/reportController');

const MATCH_ID = 19432105;

mongoose.connect(process.env.DBURI);

mongoose.connection.once('open', async () => {
  try {
    console.log('🔄 Starting Southampton report regeneration...');
    
    // Get the match
    const match = await Match.findOne({ match_id: MATCH_ID });
    if (!match) {
      console.error('❌ Match not found');
      return;
    }
    
    console.log(`📅 Match: ${match.teams?.home?.team_name || 'Unknown'} vs ${match.teams?.away?.team_name || 'Unknown'}`);
    console.log(`🕐 Date: ${match.date}`);
    
    // Get Southampton team (away team)
    const southamptonTeam = await Team.findOne({ 
      id: match.teams?.away?.team_id || 65 
    });
    
    if (!southamptonTeam) {
      console.error('❌ Southampton team not found');
      return;
    }
    
    console.log(`🏆 Regenerating report for: ${southamptonTeam.name} (Away Team)`);
    
    // Check if there's an existing away report to delete
    if (match.reports?.away) {
      console.log('🗑️ Deleting existing Southampton report...');
      await Report.findByIdAndDelete(match.reports.away);
      
      // Update match to remove the report reference
      await Match.findByIdAndUpdate(match._id, {
        $unset: { 'reports.away': 1 }
      });
    }
    
    console.log('🤖 Calling AI report generation...');
    
    // Generate the report directly using the controller function
    const result = await generateReportFor(MATCH_ID, southamptonTeam.slug);
    
    if (result && result._id) {
      console.log('✅ Southampton report regenerated successfully!');
      console.log(`📊 Report ID: ${result._id}`);
      console.log(`📝 Content length: ${result.content?.length || 0} characters`);
      if (result.embedded_tweets?.length) {
        console.log(`🐦 Embedded tweets: ${result.embedded_tweets.length}`);
        console.log('📋 Tweet preview:');
        result.embedded_tweets.slice(0, 2).forEach((tweet, i) => {
          console.log(`   ${i+1}. ${tweet.text?.substring(0, 100)}...`);
        });
      } else {
        console.log('⚠️ No tweets were embedded in the report');
      }
    } else {
      console.error('❌ Report generation failed - no result returned');
    }
    
  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    console.log('🔚 Script complete');
    mongoose.disconnect();
  }
});