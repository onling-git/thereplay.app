require('dotenv').config();
const mongoose = require('mongoose');
const Tweet = require('./models/Tweet');
const Match = require('./models/Match');
const Team = require('./models/Team');
const reportPipeline = require('./services/reportPipeline');

const MATCH_ID = 19432238;

async function testTeamTweetCollection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.DBURI);
    console.log('✅ Connected to MongoDB\n');

    // STEP 1: Show current tweet state
    console.log('=== CURRENT TWEET STATE ===');
    const currentTweets = await Tweet.find({ match_id: MATCH_ID }).lean();
    console.log(`Total tweets for match ${MATCH_ID}: ${currentTweets.length}`);
    
    const byTeam = {};
    currentTweets.forEach(t => {
      const teamId = t.team_id || 'null';
      byTeam[teamId] = (byTeam[teamId] || 0) + 1;
    });
    
    console.log('By team_id:');
    Object.entries(byTeam).forEach(([teamId, count]) => {
      console.log(`  - team_id=${teamId}: ${count} tweets`);
    });

    // STEP 2: Delete existing tweets
    console.log('\n=== DELETING OLD TWEETS ===');
    const deleteResult = await Tweet.deleteMany({ match_id: MATCH_ID });
    console.log(`Deleted ${deleteResult.deletedCount} tweets`);

    // STEP 3: Fetch match and teams
    console.log('\n=== FETCHING MATCH & TEAMS ===');
    const match = await Match.findOne({ match_id: MATCH_ID });
    if (!match) {
      console.log('❌ Match not found');
      return;
    }
    
    const homeTeamId = match.teams?.home?.team_id || match.home_team_id;
    const awayTeamId = match.teams?.away?.team_id || match.away_team_id;
    
    console.log(`Match: ${match.teams.home.name} vs ${match.teams.away.name}`);
    console.log(`Home team ID: ${homeTeamId}, Away team ID: ${awayTeamId}`);
    
    const homeTeam = await Team.findOne({ id: homeTeamId }).lean();
    const awayTeam = await Team.findOne({ id: awayTeamId }).lean();
    
    console.log('\nTeam Twitter Config:');
    console.log(`  ${homeTeam?.name}:`);
    console.log(`    - tweet_fetch_enabled: ${homeTeam?.twitter?.tweet_fetch_enabled || false}`);
    console.log(`    - has reporters: ${(homeTeam?.twitter?.reporters?.length || 0) > 0}`);
    console.log(`    - has hashtag: ${!!homeTeam?.twitter?.hashtag}`);
    
    console.log(`  ${awayTeam?.name}:`);
    console.log(`    - tweet_fetch_enabled: ${awayTeam?.twitter?.tweet_fetch_enabled || false}`);
    console.log(`    - has reporters: ${(awayTeam?.twitter?.reporters?.length || 0) > 0}`);
    console.log(`    - has hashtag: ${!!awayTeam?.twitter?.hashtag}`);

    // STEP 4: Re-collect using new team-specific logic
    console.log('\n=== COLLECTING TWEETS (NEW TEAM-SPECIFIC LOGIC) ===');
    
    if (!process.env.TWITTERAPI_KEY) {
      console.log('⚠️ TWITTERAPI_KEY not configured, skipping collection');
    } else {
      const twitterService = require('./utils/twitterService');
      
      const matchDate = new Date(match.date);
      const searchStart = new Date(matchDate.getTime() - 2 * 60 * 60 * 1000); // 2h before
      const searchEnd = new Date(matchDate.getTime() + 4 * 60 * 60 * 1000); // 4h after
      
      // Collect for both teams
      for (const teamId of [homeTeamId, awayTeamId]) {
        const team = await Team.findOne({ id: teamId }).lean();
        
        if (!team) {
          console.log(`Team ${teamId} not found`);
          continue;
        }
        
        if (!team.twitter || !team.twitter.tweet_fetch_enabled) {
          console.log(`${team.name}: No Twitter configured, skipping`);
          continue;
        }
        
        console.log(`\nCollecting tweets for ${team.name}...`);
        console.log(`  Reporters: ${team.twitter.reporters?.join(', ') || 'none'}`);
        console.log(`  Hashtag: ${team.twitter.hashtag || 'none'}`);
        
        const results = await twitterService.searchTeamTweets(team, {
          since: searchStart,
          until: searchEnd,
          queryType: 'Latest'
        });
        
        console.log(`  Found: ${results.tweets.length} tweets`);
        
        // Save tweets
        for (const tweetData of results.tweets.slice(0, 25)) {
          try {
            const existing = await Tweet.findOne({ tweet_id: tweetData.id });
            if (existing) continue;
            
            await Tweet.create({
              tweet_id: tweetData.id,
              text: tweetData.text,
              url: tweetData.url,
              author: {
                id: tweetData.author?.id,
                userName: tweetData.author?.userName,
                name: tweetData.author?.name,
                profilePicture: tweetData.author?.profilePicture,
                followers: tweetData.author?.followers,
                isBlueVerified: tweetData.author?.isBlueVerified
              },
              created_at: new Date(tweetData.createdAt),
              retweetCount: tweetData.retweetCount || 0,
              replyCount: tweetData.replyCount || 0,
              likeCount: tweetData.likeCount || 0,
              team_id: tweetData.collection_context?.team_id,
              team_slug: tweetData.collection_context?.team_slug,
              team_name: tweetData.collection_context?.team_name,
              match_id: MATCH_ID,
              match_date: match.date,
              collection_context: {
                search_query: tweetData.collection_context?.search_query || '',
                search_type: tweetData.collection_context?.search_type || 'team_source',
                collected_for: 'post_match',
                source_priority: tweetData.collection_context?.source_priority || 2
              },
              analysis: {
                is_match_related: true,
                sentiment: 'neutral'
              },
              status: 'raw',
              api_source: 'twitterapi.io'
            });
          } catch (err) {
            console.error(`Error saving tweet ${tweetData.id}:`, err.message);
          }
        }
      }
    }
    
    // STEP 5: Show new tweet state
    console.log('\n=== NEW TWEET STATE ===');
    const newTweets = await Tweet.find({ match_id: MATCH_ID }).lean();
    console.log(`Total tweets collected: ${newTweets.length}`);
    
    const newByTeam = {};
    newTweets.forEach(t => {
      const teamId = t.team_id || 'null';
      const teamName = t.team_name || 'unknown';
      const key = `${teamId} (${teamName})`;
      newByTeam[key] = (newByTeam[key] || 0) + 1;
    });
    
    console.log('By team_id:');
    Object.entries(newByTeam).forEach(([teamInfo, count]) => {
      console.log(`  - ${teamInfo}: ${count} tweets`);
    });
    
    // STEP 6: Show sample tweets
    if (newTweets.length > 0) {
      console.log('\n=== SAMPLE TWEETS ===');
      newTweets.slice(0, 3).forEach((t, i) => {
        console.log(`\nTweet ${i + 1}:`);
        console.log(`  team_id: ${t.team_id}`);
        console.log(`  team_name: ${t.team_name}`);
        console.log(`  author: @${t.author.userName}`);
        console.log(`  text: ${t.text.substring(0, 100)}...`);
        console.log(`  source: ${t.collection_context?.search_type || 'unknown'}`);
      });
    }
    
    console.log('\n✅ TEST COMPLETE');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

testTeamTweetCollection();
