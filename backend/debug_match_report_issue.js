// Debug why match 19615693 has no report
require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('./models/Match');

async function debugMatch() {
  try {
    const uri = process.env.DBURI || process.env.MONGODB_URI || 'mongodb://localhost:27017/thefinalplay';
    await mongoose.connect(uri);
    console.log('📊 Connected to database');

    const matchId = 19615693;
    const match = await Match.findOne({ match_id: matchId }).lean();
    
    if (!match) {
      console.log('❌ Match', matchId, 'not found');
      return;
    }

    console.log('✅ Found Liverpool vs Barnsley match');
    console.log('📅 Date:', match.date);
    console.log('🏆 League:', match.match_info?.league?.name || match.league?.name || 'MISSING');
    console.log('🟢 Status:', match.match_status?.name || match.match_status || 'UNKNOWN');

    // Check all report generation criteria
    console.log('\n🔍 REPORT GENERATION CRITERIA CHECK:');
    
    // 1. Match Status
    const isFinished = match.match_status?.name === 'Full Time' || match.match_status === 'Full Time';
    console.log(`1. ✓ Match Status: ${match.match_status?.name || match.match_status} ${isFinished ? '✅' : '❌'}`);
    
    // 2. Scores
    const hasScores = match.score && typeof match.score.home === 'number' && typeof match.score.away === 'number';
    console.log(`2. ✓ Scores: ${match.score?.home || 'missing'} - ${match.score?.away || 'missing'} ${hasScores ? '✅' : '❌'}`);
    
    // 3. Lineup data
    const hasLineup = match.lineup && match.lineup.home && match.lineup.away;
    const homeCount = match.lineup?.home?.length || 0;
    const awayCount = match.lineup?.away?.length || 0;
    console.log(`3. ✓ Lineup: Home ${homeCount}, Away ${awayCount} ${(homeCount >= 11 && awayCount >= 11) ? '✅' : '❌'}`);
    
    // 4. Player names
    if (hasLineup) {
      const homeMissingNames = match.lineup.home.filter(p => !p.player_name || p.player_name.trim() === '').length;
      const awayMissingNames = match.lineup.away.filter(p => !p.player_name || p.player_name.trim() === '').length;
      console.log(`4. ✓ Player Names: Missing ${homeMissingNames + awayMissingNames} names ${(homeMissingNames === 0 && awayMissingNames === 0) ? '✅' : '❌'}`);
    } else {
      console.log('4. ❌ Player Names: No lineup data');
    }
    
    // 5. Player ratings
    const hasRatings = match.player_ratings && match.player_ratings.length > 0;
    console.log(`5. ✓ Player Ratings: ${match.player_ratings?.length || 0} ratings ${hasRatings ? '✅' : '❌'}`);
    
    // 6. POTM
    const hasPOTM = match.potm && match.potm.home?.player && match.potm.away?.player;
    console.log(`6. ✓ POTM: Home ${match.potm?.home?.player?.name || 'missing'}, Away ${match.potm?.away?.player?.name || 'missing'} ${hasPOTM ? '✅' : '❌'}`);
    
    // 7. Reports
    const hasReports = match.reports && match.reports.home && match.reports.away;
    console.log(`7. ✓ Reports: ${hasReports ? 'Exist' : 'Missing'} ${hasReports ? '✅' : '❌'}`);

    // Summary
    console.log('\n📋 SUMMARY:');
    const allCriteriaMet = isFinished && hasScores && hasLineup && hasRatings && hasPOTM;
    console.log(`All criteria met: ${allCriteriaMet ? '✅ YES' : '❌ NO'}`);
    
    if (!allCriteriaMet) {
      console.log('🚨 BLOCKING ISSUES:');
      if (!isFinished) console.log('   - Match not finished');
      if (!hasScores) console.log('   - Missing scores');
      if (!hasLineup) console.log('   - Missing/incomplete lineup');
      if (!hasRatings) console.log('   - Missing player ratings');
      if (!hasPOTM) console.log('   - Missing POTM data');
    }

    // Check if this is a league we process
    const leagueId = match.match_info?.league?.id || match.league?.id;
    const isProcessedLeague = [8, 9, 24].includes(leagueId); // Premier League (8), Championship (9), FA Cup (24)
    console.log(`\n🏆 League Check: ID ${leagueId} ${isProcessedLeague ? '✅ Processed' : '❌ Not processed'}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('📊 Disconnected from database');
  }
}

debugMatch();