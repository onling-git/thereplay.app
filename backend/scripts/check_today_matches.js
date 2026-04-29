/**
 * Check today's matches - their times and statuses
 */

require('dotenv').config();
const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || process.env.DBURI;

async function checkTodayMatches() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ Connected to MongoDB\n');

    const Match = mongoose.model('Match', new mongoose.Schema({}, { strict: false, collection: 'matches' }));
    
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
    
    console.log('📅 Checking matches for today:', today.toISOString().split('T')[0]);
    console.log('🕐 Current time:', today.toISOString());
    console.log('');

    const matches = await Match.find({
      'match_info.starting_at': {
        $gte: startOfDay,
        $lte: endOfDay
      }
    })
    .select('match_id home_team away_team match_info.starting_at match_status state')
    .sort({ 'match_info.starting_at': 1 })
    .lean();

    console.log(`Found ${matches.length} matches today:\n`);

    matches.forEach((m, i) => {
      const startTime = new Date(m.match_info?.starting_at || m.date);
      const status = m.match_status?.state || m.state || 'UNKNOWN';
      const homeTeam = m.home_team || m.teams?.home?.team_name || 'Home';
      const awayTeam = m.away_team || m.teams?.away?.team_name || 'Away';
      
      const minutesUntil = Math.round((startTime - today) / 60000);
      const timeInfo = minutesUntil > 0 
        ? `in ${minutesUntil} minutes` 
        : `${Math.abs(minutesUntil)} minutes ago`;

      console.log(`${i + 1}. ${homeTeam} vs ${awayTeam}`);
      console.log(`   🕐 Kick-off: ${startTime.toISOString()} (${timeInfo})`);
      console.log(`   📊 Status: ${status}`);
      console.log(`   🆔 Match ID: ${m.match_id}`);
      console.log('');
    });

    // Count by status
    const statusCounts = {};
    matches.forEach(m => {
      const status = m.match_status?.state || m.state || 'UNKNOWN';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    console.log('📊 Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkTodayMatches();
