require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

const DBURI = process.env.DBURI;
mongoose.connect(DBURI);

mongoose.connection.once('open', async () => {
  try {
    console.log('Connected to database');
    
    const matchId = 19432044;
    const match = await Match.findOne({ match_id: matchId });
    
    if (!match) {
      console.log(`❌ Match ${matchId} not found`);
      process.exit(1);
    }
    
    console.log(`\n=== MATCH ${matchId} DATE & STATUS ANALYSIS ===`);
    console.log('Match Date Fields:');
    console.log('  match_info.starting_at:', match.match_info?.starting_at);
    console.log('  date:', match.date);
    
    console.log('\nMatch Status Fields:');
    console.log('  match_status:', match.match_status);
    console.log('  status:', match.status);
    
    // Check current date vs match date
    const now = new Date();
    const matchDate = match.match_info?.starting_at || match.date;
    
    console.log('\nDate Comparison:');
    console.log('  Current time:', now.toISOString());
    console.log('  Match date:', matchDate);
    console.log('  Match is in past?', new Date(matchDate) <= now);
    
    // Show Southampton team info
    const homeTeamId = match.teams?.home?.team_id;
    const awayTeamId = match.teams?.away?.team_id;
    console.log('\nTeam Information:');
    console.log('  Home team ID:', homeTeamId);
    console.log('  Away team ID:', awayTeamId);
    console.log('  Home team name:', match.teams?.home?.team_name);
    console.log('  Away team name:', match.teams?.away?.team_name);
    
    // Check if this is a Southampton match (team ID 65)
    const isSouthamptonMatch = homeTeamId === 65 || awayTeamId === 65;
    console.log('  Is Southampton match?', isSouthamptonMatch);
    
    // Find the most recent finished Southampton matches to compare
    console.log('\n=== RECENT SOUTHAMPTON MATCHES (for comparison) ===');
    const recentMatches = await Match.find({
      $or: [
        { 'teams.home.team_id': 65 },
        { 'teams.away.team_id': 65 }
      ]
    }).sort({ 'match_info.starting_at': -1 }).limit(3);
    
    recentMatches.forEach((recentMatch, i) => {
      console.log(`${i + 1}. Match ${recentMatch.match_id}:`);
      console.log(`   Date: ${recentMatch.match_info?.starting_at || recentMatch.date}`);
      console.log(`   Status: ${recentMatch.match_status?.state || recentMatch.status}`);
      console.log(`   Teams: ${recentMatch.teams?.home?.team_name} vs ${recentMatch.teams?.away?.team_name}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
});