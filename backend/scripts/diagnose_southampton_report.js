require('dotenv').config();
const mongoose = require('mongoose');
const Match = require('../models/Match');
const Tweet = require('../models/Tweet');

async function diagnoseSouthamptonMatch() {
  await mongoose.connect(process.env.DBURI);
  
  const match = await Match.findOne({
    $or: [
      { home_team: 'Southampton', away_team: 'Ipswich Town' },
      { 'teams.home.team_name': 'Southampton', 'teams.away.team_name': 'Ipswich Town' }
    ],
    'match_status.state': 'FT'
  }).sort({ date: -1 }).lean();
  
  if (!match) {
    console.log('❌ Match not found');
    process.exit(1);
  }
  
  console.log('🏟️  Southampton vs Ipswich Town');
  console.log('Match ID:', match.match_id);
  console.log('Date:', match.date);
  console.log('Status:', match.match_status?.state, match.match_status?.short_name);
  console.log('\n=== DATA DIAGNOSTIC ===\n');
  
  // 1. Check if reports were generated
  console.log('1️⃣  REPORTS:');
  console.log('   - reports object:', match.reports ? 'EXISTS' : 'MISSING');
  if (match.reports) {
    console.log('   - home report:', match.reports.home ? 'EXISTS' : 'MISSING');
    console.log('   - away report:', match.reports.away ? 'EXISTS' : 'MISSING');
    console.log('   - generated_at:', match.reports.generated_at);
  }
  
  // 2. Check player ratings
  console.log('\n2️⃣  PLAYER RATINGS:');
  const ratingsCount = match.player_ratings?.length || 0;
  console.log('   - Count:', ratingsCount);
  if (ratingsCount > 0) {
    console.log('   - Sample:', match.player_ratings[0]);
  } else {
    console.log('   ❌ NO PLAYER RATINGS - This is why POTM is null');
    console.log('   💡 Player ratings should be fetched by syncFinishedMatch()');
    console.log('   💡 Check if Sportmonks provides ratings for this match/league');
  }
  
  // 3. Check tweets for report context
  console.log('\n3️⃣  TWEETS FOR REPORT:');
  
  // Check for match-associated tweets
  const matchTweets = await Tweet.countDocuments({ match_id: match.match_id });
  console.log('   - Match-linked tweets:', matchTweets);
  
  // Check for team reporter tweets during match timeframe
  const matchDate = new Date(match.date);
  const searchStart = new Date(matchDate.getTime() - 2 * 60 * 60 * 1000); // 2h before
  const searchEnd = new Date(matchDate.getTime() + 3 * 60 * 60 * 1000);   // 3h after
  
  const homeTeamId = match.teams?.home?.team_id || match.home_team_id;
  const awayTeamId = match.teams?.away?.team_id || match.away_team_id;
  
  const timeframeTweets = await Tweet.countDocuments({
    team_id: { $in: [homeTeamId, awayTeamId] },
    created_at: { $gte: searchStart, $lte: searchEnd }
  });
  
  console.log('   - Timeframe tweets (2h before to 3h after):', timeframeTweets);
  
  // Check if teams have reporters configured
  const Team = require('../models/Team');
  const southampton = await Team.findOne({ id: homeTeamId }).lean();
  const ipswich = await Team.findOne({ id: awayTeamId }).lean();
  
  console.log('\n4️⃣  TWITTER CONFIGURATION:');
  console.log('   Southampton:');
  if (southampton?.twitter?.reporters) {
    console.log('     ✅ Reporters:', southampton.twitter.reporters.length);
    southampton.twitter.reporters.forEach(r => {
      console.log('       -', r.name, r.handle);
    });
  } else {
    console.log('     ❌ No reporters configured');
  }
  
  console.log('   Ipswich:');
  if (ipswich?.twitter?.reporters) {
    console.log('     ✅ Reporters:', ipswich.twitter.reporters.length);
    ipswich.twitter.reporters.forEach(r => {
      console.log('       -', r.name, r.handle);
    });
  } else {
    console.log('     ❌ No reporters configured');
  }
  
  // 5. Check if ensureTweetsExist would have collected tweets
  console.log('\n5️⃣  TWEET AUTO-COLLECTION:');
  const requiredTweets = 5;
  const totalAvailable = matchTweets + timeframeTweets;
  console.log('   - Total available:', totalAvailable);
  console.log('   - Required minimum:', requiredTweets);
  
  if (totalAvailable >= requiredTweets) {
    console.log('   ✅ Sufficient tweets (auto-collection skipped)');
  } else {
    console.log('   ⚠️  INSUFFICIENT TWEETS - auto-collection should have run');
    console.log('   💡 Check if:');
    console.log('      - TwitterAPI is configured (TWITTERAPI_KEY set?)');
    console.log('      - Report generation was actually triggered');
    console.log('      - Auto-collection ran but found no matching tweets');
  }
  
  console.log('\n6️⃣  RECOMMENDATIONS:');
  
  if (ratingsCount === 0) {
    console.log('   📌 Player ratings missing:');
    console.log('      1. Fetch match directly from Sportmonks to check if ratings available');
    console.log('      2. Run syncFinishedMatch(', match.match_id, ') manually');
    console.log('      3. Check if Championship has player ratings in your Sportmonks plan');
  }
  
  if (timeframeTweets < requiredTweets) {
    console.log('   📌 Tweets not collected:');
    console.log('      1. Check if report generation was triggered (enhancedFinishedMatchCheck)');
    console.log('      2. Verify TWITTERAPI_KEY is configured');
    console.log('      3. Manually collect tweets for match timeframe');
    console.log('      4. Re-generate reports after collecting data');
  }
  
  if (!match.reports || !match.reports.home || !match.reports.away) {
    console.log('   📌 Reports missing:');
    console.log('      1. Check cron logs for enhancedFinishedMatchCheck execution');
    console.log('      2. Verify match state transition was detected (NS → FT)');
    console.log('      3. Check /api/reports/v2 endpoint logs for errors');
    console.log('      4. Manually trigger: POST /api/reports/v2/southampton/match/', match.match_id, '/generate-both');
  }
  
  process.exit(0);
}

diagnoseSouthamptonMatch();
