require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

const DBURI = process.env.DBURI;
mongoose.connect(DBURI);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    
    console.log('\n=== FINDING SOUTHAMPTON ACTUAL LAST MATCH ===');
    
    const now = new Date();
    console.log('Current time:', now.toISOString());
    
    // Find Southampton's most recent FINISHED match
    const lastFinishedMatch = await Match.findOne({
      $and: [
        {
          $or: [
            { 'teams.home.team_id': 65 },
            { 'teams.away.team_id': 65 }
          ]
        },
        {
          $or: [
            { 'match_info.starting_at': { $lte: now } },
            { date: { $lte: now } }
          ]
        },
        {
          $or: [
            { 'match_status.state': /finished|ft/i },
            { 'match_status.name': /finished|ft/i },
            { 'match_status': 'FT' },
            { status: /finished|ft/i }
          ]
        }
      ]
    }).sort({ 'match_info.starting_at': -1, date: -1 });
    
    if (lastFinishedMatch) {
      console.log('✅ Found Southampton last finished match:');
      console.log('  Match ID:', lastFinishedMatch.match_id);
      console.log('  Date:', lastFinishedMatch.match_info?.starting_at || lastFinishedMatch.date);
      console.log('  Status:', lastFinishedMatch.match_status || lastFinishedMatch.status);
      console.log('  Teams:', `${lastFinishedMatch.teams?.home?.team_name} vs ${lastFinishedMatch.teams?.away?.team_name}`);
    } else {
      console.log('❌ No finished Southampton matches found');
    }
    
    // Find Southampton's most recent match regardless of status
    const lastAnyMatch = await Match.findOne({
      $or: [
        { 'teams.home.team_id': 65 },
        { 'teams.away.team_id': 65 }
      ]
    }).sort({ 'match_info.starting_at': -1, date: -1 });
    
    if (lastAnyMatch) {
      console.log('\n📅 Southampton most recent match (any status):');
      console.log('  Match ID:', lastAnyMatch.match_id);
      console.log('  Date:', lastAnyMatch.match_info?.starting_at || lastAnyMatch.date);
      console.log('  Status:', lastAnyMatch.match_status || lastAnyMatch.status);
      console.log('  Teams:', `${lastAnyMatch.teams?.home?.team_name} vs ${lastAnyMatch.teams?.away?.team_name}`);
    }
    
    // Let's also check what team 19432044 actually belongs to
    const match19432044 = await Match.findOne({ match_id: 19432044 });
    if (match19432044) {
      console.log('\n🔍 Match 19432044 details:');
      console.log('  Home team ID:', match19432044.teams?.home?.team_id, '(' + match19432044.teams?.home?.team_name + ')');
      console.log('  Away team ID:', match19432044.teams?.away?.team_id, '(' + match19432044.teams?.away?.team_name + ')');
      console.log('  Should show for which team slugs?');
      
      // Check team slugs
      if (match19432044.teams?.home?.team_slug) {
        console.log('  Home team slug:', match19432044.teams.home.team_slug);
      }
      if (match19432044.teams?.away?.team_slug) {
        console.log('  Away team slug:', match19432044.teams.away.team_slug);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});