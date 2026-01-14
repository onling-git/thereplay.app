require('dotenv').config();
const { connectDB } = require('./db/connect');
const Team = require('./models/Team');
const Match = require('./models/Match');

async function debugSouthampton() {
  try {
    await connectDB(process.env.DBURI);
    console.log('Connected to database');
    
    console.log('\n=== SOUTHAMPTON TEAM DATA ===');
    const team = await Team.findOne({ slug: 'southampton' }).lean();
    if (!team) {
      console.log('Team not found! Checking for similar names...');
      const similarTeams = await Team.find({ name: /southampton/i }).select('name slug').lean();
      console.log('Similar teams:', similarTeams);
      return;
    }
    
    console.log('Team data:', {
      name: team.name,
      slug: team.slug,
      id: team.id,
      last_match: team.last_match,
      next_match: team.next_match,
      last_match_info: team.last_match_info,
      next_match_info: team.next_match_info,
      last_played_at: team.last_played_at,
      next_game_at: team.next_game_at,
      cache_metadata: team.cache_metadata
    });
    
    console.log('\n=== RECENT MATCHES FOR SOUTHAMPTON (by team_id) ===');
    const matches = await Match.find({
      $or: [
        { 'teams.home.team_id': team.id },
        { 'teams.away.team_id': team.id }
      ]
    }).sort({ 'match_info.starting_at': -1 }).limit(10).lean();
    
    console.log(`Found ${matches.length} matches:`);
    matches.forEach((match, i) => {
      console.log(`\nMatch ${i + 1}: ${match.match_id}`);
      console.log(`  Date: ${match.match_info?.starting_at || match.date}`);
      console.log(`  Home: ${match.teams?.home?.team_name} (ID: ${match.teams?.home?.team_id})`);
      console.log(`  Away: ${match.teams?.away?.team_name} (ID: ${match.teams?.away?.team_id})`);
      console.log(`  Status: ${match.match_status?.state || match.status}`);
      console.log(`  Score: ${match.scores?.home_score || 0}-${match.scores?.away_score || 0}`);
    });
    
    console.log('\n=== CHECKING SPECIFIC MATCH IDS ===');
    const match19431929 = await Match.findOne({ match_id: 19431929 }).lean();
    const match19431943 = await Match.findOne({ match_id: 19431943 }).lean();
    
    console.log('\nMatch 19431929 (should be last):', match19431929 ? {
      match_id: match19431929.match_id,
      date: match19431929.match_info?.starting_at || match19431929.date,
      home: match19431929.teams?.home?.team_name,
      away: match19431929.teams?.away?.team_name,
      status: match19431929.match_status?.state,
      score: `${match19431929.scores?.home_score || 0}-${match19431929.scores?.away_score || 0}`
    } : 'Match not found');
    
    console.log('\nMatch 19431943 (should be next):', match19431943 ? {
      match_id: match19431943.match_id,
      date: match19431943.match_info?.starting_at || match19431943.date,
      home: match19431943.teams?.home?.team_name,
      away: match19431943.teams?.away?.team_name,
      status: match19431943.match_status?.state,
      score: `${match19431943.scores?.home_score || 0}-${match19431943.scores?.away_score || 0}`
    } : 'Match not found');
    
    console.log('\n=== CHECKING TODAY\'S DATE AND FILTERING ===');
    const now = new Date();
    console.log(`Current date: ${now.toISOString()}`);
    
    // Find finished matches
    const finishedMatches = await Match.find({
      $and: [
        {
          $or: [
            { 'teams.home.team_id': team.id },
            { 'teams.away.team_id': team.id }
          ]
        },
        {
          'match_info.starting_at': { $lte: now }
        },
        {
          $or: [
            { 'match_status.state': /finished/i },
            { 'match_status.name': /finished/i }
          ]
        }
      ]
    }).sort({ 'match_info.starting_at': -1 }).limit(3).lean();
    
    console.log('\nFinished matches:');
    finishedMatches.forEach((match, i) => {
      console.log(`  ${i + 1}. ${match.match_id} - ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name} (${match.match_info?.starting_at})`);
    });
    
    // Find upcoming matches
    const upcomingMatches = await Match.find({
      $and: [
        {
          $or: [
            { 'teams.home.team_id': team.id },
            { 'teams.away.team_id': team.id }
          ]
        },
        {
          'match_info.starting_at': { $gt: now }
        }
      ]
    }).sort({ 'match_info.starting_at': 1 }).limit(3).lean();
    
    console.log('\nUpcoming matches:');
    upcomingMatches.forEach((match, i) => {
      console.log(`  ${i + 1}. ${match.match_id} - ${match.teams?.home?.team_name} vs ${match.teams?.away?.team_name} (${match.match_info?.starting_at})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugSouthampton();