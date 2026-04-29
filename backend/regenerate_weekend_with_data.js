// Comprehensive script to collect player ratings and reporter tweets for weekend matches
// Then regenerate reports with proper data
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const mongoose = require('mongoose');
const axios = require('axios');
const Match = require('./models/Match');
const Team = require('./models/Team');
const Tweet = require('./models/Tweet');
const Report = require('./models/Report');
const twitterService = require('./utils/twitterService');
const { generateBothReports } = require('./controllers/reportController');

const MATCH_IDS = [19432260, 19432257];
const SPORTMONKS_API_KEY = process.env.SPORTMONKS_API_KEY;
const SPORTMONKS_BASE = process.env.SPORTMONKS_BASE || 'https://api.sportmonks.com/v3/football';

/**
 * Step 1: Fetch player ratings from Sportmonks
 */
async function fetchPlayerRatings(matchId) {
  try {
    console.log(`\n📊 Fetching player ratings for match ${matchId}...`);
    
    const url = `${SPORTMONKS_BASE}/fixtures/${matchId}`;
    const response = await axios.get(url, {
      params: {
        api_token: SPORTMONKS_API_KEY,
        include: 'lineups.details'
      }
    });
    
    const fixture = response.data?.data;
    if (!fixture) {
      console.log(`❌ No fixture data returned`);
      return [];
    }
    
    // Extract player ratings from lineups
    const ratings = [];
    
    if (fixture.lineups && Array.isArray(fixture.lineups)) {
      for (const lineup of fixture.lineups) {
        // Check if this lineup entry has rating in details (type_id 118 = RATING)
        const ratingDetail = lineup.details?.find(d => d.type_id === 118);
        
        if (ratingDetail && ratingDetail.data?.value) {
          ratings.push({
            player: lineup.player_name || null,
            player_id: lineup.player_id,
            rating: Number(ratingDetail.data.value),
            team_id: lineup.team_id,
            team: null, // Will be filled in when saving to match
            inferred: false,
            source: 'sportmonks-lineup-detail',
            calculated_at: new Date()
          });
        }
      }
    }
    
    console.log(`✅ Found ${ratings.length} player ratings`);
    return ratings;
    
  } catch (error) {
    console.error(`❌ Error fetching player ratings:`, error.response?.data || error.message);
    return [];
  }
}

/**
 * Step 2: Collect tweets from reporters during match time window
 * IMPORTANT: Uses reporters from team.twitter.reporters, NOT hashtags
 */
async function collectReporterTweets(match, team) {
  try {
    if (!team.twitter?.reporters || team.twitter.reporters.length === 0) {
      console.log(`⚠️ No reporters configured for ${team.name}`);
      return 0;
    }
    
    console.log(`\n🐦 Collecting reporter tweets for ${team.name}...`);
    console.log(`   Reporters: ${team.twitter.reporters.map(r => r.handle).join(', ')}`);
    
    // Define match time window (2 hours before to 3 hours after)
    const matchDate = new Date(match.date);
    const searchStart = new Date(matchDate.getTime() - 2 * 60 * 60 * 1000);
    const searchEnd = new Date(matchDate.getTime() + 3 * 60 * 60 * 1000);
    
    console.log(`   Time window: ${searchStart.toISOString()} to ${searchEnd.toISOString()}`);
    
    // Get reporter handles
    const reporterHandles = team.twitter.reporters.map(r => r.handle);
    
    // Search tweets from reporters during match time
    const result = await twitterService.searchByUser(reporterHandles, {
      since: searchStart,
      until: searchEnd,
      hashtag: team.twitter.hashtag, // Include team hashtag to filter match-related tweets
      queryType: 'Latest'
    });
    
    console.log(`   Found ${result.tweets.length} tweets from reporters`);
    
    // Save tweets to database
    let savedCount = 0;
    let skippedCount = 0;
    
    for (const tweetData of result.tweets) {
      try {
        // Check if already exists
        const existing = await Tweet.findOne({ tweet_id: tweetData.id });
        if (existing) {
          skippedCount++;
          continue;
        }
        
        // Transform and save
        const tweetDoc = new Tweet({
          tweet_id: tweetData.id,
          text: tweetData.text,
          url: tweetData.url,
          
          author: {
            id: tweetData.author?.id,
            userName: tweetData.author?.userName,
            name: tweetData.author?.name,
            profilePicture: tweetData.author?.profilePicture,
            followers: tweetData.author?.followers,
            isBlueVerified: tweetData.author?.isBlueVerified,
          },
          
          created_at: new Date(tweetData.createdAt),
          retweetCount: tweetData.retweetCount || 0,
          replyCount: tweetData.replyCount || 0,
          likeCount: tweetData.likeCount || 0,
          quoteCount: tweetData.quoteCount || 0,
          
          lang: tweetData.lang,
          source: tweetData.source,
          isReply: tweetData.isReply || false,
          
          entities: {
            hashtags: tweetData.entities?.hashtags?.map(h => ({ text: h.text })) || [],
            urls: tweetData.entities?.urls?.map(u => ({ 
              display_url: u.display_url,
              expanded_url: u.expanded_url 
            })) || []
          },
          
          // Team association
          team_id: team.id,
          team_slug: team.slug,
          team_name: team.name,
          
          // Match association
          match_id: match.match_id,
          match_date: match.date,
          
          // Collection context - MARK AS REPORTER TWEET
          collection_context: {
            search_query: `from reporters during match`,
            search_type: 'reporter', // CRITICAL: This marks it as a reporter tweet
            collected_for: 'live_match', // Valid enum: pre_match, live_match, post_match, general, team_feed
            source_priority: 1, // Reporters have highest priority
            team_id: team.id,
            team_slug: team.slug
          }
        });
        
        await tweetDoc.save();
        savedCount++;
        
      } catch (error) {
        console.error(`   Error saving tweet ${tweetData.id}:`, error.message);
      }
    }
    
    console.log(`   ✅ Saved ${savedCount} new tweets, skipped ${skippedCount} duplicates`);
    return savedCount;
    
  } catch (error) {
    console.error(`❌ Error collecting tweets for ${team.name}:`, error.message);
    return 0;
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔄 Starting comprehensive weekend report regeneration...\n');
  console.log('Match IDs:', MATCH_IDS.join(', '));
  console.log('');
  
  await mongoose.connect(process.env.DBURI);
  console.log('✅ Connected to MongoDB\n');
  
  for (const matchId of MATCH_IDS) {
    console.log('='.repeat(80));
    console.log(`📋 Processing Match ID: ${matchId}`);
    console.log('='.repeat(80));
    
    try {
      // Fetch match
      const match = await Match.findOne({ match_id: matchId });
      if (!match) {
        console.error(`❌ Match ${matchId} not found in database`);
        continue;
      }
      
      console.log(`Match: ${match.home_team} vs ${match.away_team}`);
      console.log(`Date: ${match.date}`);
      console.log(`Score: ${match.score?.home ?? 0} - ${match.score?.away ?? 0}`);
      
      // STEP 1: Fetch and update player ratings
      const playerRatings = await fetchPlayerRatings(matchId);
      if (playerRatings.length > 0) {
        await Match.updateOne(
          { match_id: matchId },
          { $set: { player_ratings: playerRatings } }
        );
        console.log(`✅ Updated match with ${playerRatings.length} player ratings`);
      }
      
      // STEP 2: Collect reporter tweets for BOTH teams
      const homeTeamId = match.teams?.home?.team_id || match.home_team_id;
      const awayTeamId = match.teams?.away?.team_id || match.away_team_id;
      
      const homeTeam = await Team.findOne({ id: homeTeamId });
      const awayTeam = await Team.findOne({ id: awayTeamId });
      
      if (homeTeam) {
        const tweetsCollected = await collectReporterTweets(match, homeTeam);
        console.log(`✅ Collected ${tweetsCollected} reporter tweets for ${homeTeam.name}`);
      } else {
        console.log(`⚠️ Home team not found in database`);
      }
      
      if (awayTeam) {
        const tweetsCollected = await collectReporterTweets(match, awayTeam);
        console.log(`✅ Collected ${tweetsCollected} reporter tweets for ${awayTeam.name}`);
      } else {
        console.log(`⚠️ Away team not found in database`);
      }
      
      // STEP 3: Delete existing reports to force regeneration
      console.log(`\n🗑️  Deleting existing reports for match ${matchId}...`);
      
      // Delete from Report collection
      const deleteResult = await Report.deleteMany({ match_id: matchId });
      console.log(`   Deleted ${deleteResult.deletedCount} reports from Report collection`);
      
      // Clear reports field from Match document to force regeneration
      await Match.updateOne(
        { match_id: matchId },
        { $unset: { 'reports.home': '', 'reports.away': '' } }
      );
      console.log(`   Cleared match.reports fields`);
      
      // STEP 4: Regenerate reports
      console.log(`\n📝 Regenerating reports...`);
      const reports = await generateBothReports(matchId);
      
      console.log(`✅ Generated ${reports.length} reports:`);
      reports.forEach(r => {
        console.log(`   - ${r.team_focus}: ${r.headline?.substring(0, 60)}...`);
        console.log(`     MOTM: ${r.man_of_the_match || 'N/A'}`);
      });
      
    } catch (error) {
      console.error(`❌ Error processing match ${matchId}:`, error.message);
    }
    
    console.log('');
  }
  
  console.log('='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  console.log(`✅ Processing complete for ${MATCH_IDS.length} matches`);
  
  await mongoose.disconnect();
  console.log('\n✅ Disconnected from MongoDB');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
