// services/reportPipeline.js
// Orchestrator for the 2-step match report generation pipeline

const { interpretMatch } = require('./matchInterpretation');
const { writeMatchReport } = require('./matchReportWriter');
const Match = require('../models/Match');
const Team = require('../models/Team');
const Tweet = require('../models/Tweet');
const twitterService = require('../utils/twitterService');

/**
 * Execute the full 2-step pipeline to generate a match report
 * 
 * @param {Object} params - Input parameters
 * @param {Number} params.matchId - Match ID
 * @param {String} params.teamSlug - Team slug (or synthetic like __home_<id>)
 * @param {Object} params.options - Optional configuration
 * @param {Boolean} params.options.saveInterpretation - Whether to store interpretation separately
 * @param {Boolean} params.options.autoCollectTweets - Whether to auto-collect tweets if missing (default: true)
 * @param {Number} params.options.minTweetsRequired - Minimum tweets before auto-collection (default: 5)
 * @returns {Promise<Object>} Generated report with metadata
 */
async function generateReportPipeline({ matchId, teamSlug, options = {} }) {
  console.log(`[ReportPipeline] Starting for match ${matchId}, team ${teamSlug}`);
  
  // Set defaults for auto-collection
  const autoCollectTweets = options.autoCollectTweets !== false; // Default true
  const minTweetsRequired = options.minTweetsRequired || 5;
  
  // ===== PHASE 0: Data Preparation (with auto tweet collection) =====
  const { match, team, teamFocus, teamSide, tweets, competitionContext } = await prepareMatchData(
    matchId, 
    teamSlug,
    { autoCollectTweets, minTweetsRequired }
  );
  
  // ===== PHASE 1: Match Interpretation =====
  console.log(`[ReportPipeline] Step 1: Interpreting match narrative...`);
  const startInterpretation = Date.now();
  
  const interpretation = await interpretMatch({
    match,
    tweets,
    teamFocus,
    teamSide,
    isCup: competitionContext.is_cup,
    competitionName: competitionContext.name,
    competitionStage: competitionContext.stage
  });
  
  const interpretationTime = Date.now() - startInterpretation;
  console.log(`[ReportPipeline] Step 1 complete (${interpretationTime}ms)`);
  
  // Optionally save interpretation for debugging/analysis
  if (options.saveInterpretation) {
    await saveInterpretation(matchId, teamSlug, interpretation);
  }
  
  // ===== PHASE 2: Determine POTM =====
  const potm = determinePOTM(match, teamSide);
  console.log(`[ReportPipeline] POTM: ${potm.player} (${potm.rating})`);
  
  // ===== PHASE 3: Write Report =====
  console.log(`[ReportPipeline] Step 2: Writing match report...`);
  const startWriting = Date.now();
  
  const report = await writeMatchReport({
    interpretation,
    match,
    teamFocus,
    potm,
    isCup: competitionContext.is_cup,
    competitionName: competitionContext.name,
    competitionStage: competitionContext.stage
  });
  
  const writingTime = Date.now() - startWriting;
  console.log(`[ReportPipeline] Step 2 complete (${writingTime}ms)`);
  
  // ===== PHASE 4: Enrich Report =====
  const enrichedReport = enrichReport({
    report,
    interpretation,
    match,
    team,
    teamFocus,
    tweets,
    competitionContext
  });
  
  // Add pipeline metadata
  enrichedReport.meta = {
    ...enrichedReport.meta,
    pipeline: {
      version: '2.0',
      interpretation_time_ms: interpretationTime,
      writing_time_ms: writingTime,
      total_time_ms: interpretationTime + writingTime
    }
  };
  
  console.log(`[ReportPipeline] Complete in ${interpretationTime + writingTime}ms`);
  
  return {
    report: enrichedReport,
    interpretation, // Return for debugging/storage
    metadata: {
      match_id: match.match_id,
      team_slug: teamSlug,
      team_name: teamFocus,
      competition: competitionContext.name,
      stage: competitionContext.stage,
      is_cup: competitionContext.is_cup
    }
  };
}

/**
 * Prepare all required data for report generation
 */
async function prepareMatchData(matchId, teamSlug, options = {}) {
  // Fetch match
  const match = await Match.findOne({ match_id: Number(matchId) }).lean();
  if (!match) throw new Error('Match not found');
  
  // Auto-collect tweets if needed (before other preparations)
  if (options.autoCollectTweets !== false) {
    await ensureTweetsExist(match, options.minTweetsRequired || 5);
  }
  
  // Determine team focus
  let team = null;
  let teamFocus = null;
  let teamSide = null; // 'home' or 'away'
  
  if (String(teamSlug || '').startsWith('__home_')) {
    teamFocus = match.home_team || (match.teams?.home?.team_name) || 'Home Team';
    teamSide = 'home';
  } else if (String(teamSlug || '').startsWith('__away_')) {
    teamFocus = match.away_team || (match.teams?.away?.team_name) || 'Away Team';
    teamSide = 'away';
  } else {
    team = await Team.findOne({ slug: teamSlug }).lean();
    teamFocus = team?.name;
    
    if (!teamFocus) {
      // Fallback: derive from match
      if (String(teamSlug).toLowerCase() === String(match.home_team_slug).toLowerCase()) {
        teamFocus = match.home_team;
        teamSide = 'home';
      } else if (String(teamSlug).toLowerCase() === String(match.away_team_slug).toLowerCase()) {
        teamFocus = match.away_team;
        teamSide = 'away';
      } else {
        teamFocus = teamSlug || match.home_team || 'Home Team';
        teamSide = 'home'; // default
      }
    } else {
      // Determine side from team name comparison
      const homeTeamName = match.home_team || match.teams?.home?.team_name;
      const awayTeamName = match.away_team || match.teams?.away?.team_name;
      
      if (teamFocus === homeTeamName) {
        teamSide = 'home';
      } else if (teamFocus === awayTeamName) {
        teamSide = 'away';
      } else {
        // Fuzzy match by slug
        const homeSlug = match.home_team_slug || match.teams?.home?.team_slug;
        const awaySlug = match.away_team_slug || match.teams?.away?.team_slug;
        teamSide = (teamSlug === awaySlug) ? 'away' : 'home';
      }
    }
  }
  
  // Get competition context
  const competitionContext = getCompetitionContext(match);
  
  // Fetch relevant tweets (only for THIS team to avoid bias)
  const tweets = await fetchRelevantTweets(match, team, teamSide);
  
  return { match, team, teamFocus, teamSide, tweets, competitionContext };
}

/**
 * Ensure tweets exist for a match - collect automatically if needed
 * This runs BEFORE report generation to ensure fresh social context
 * IMPORTANT: Collects tweets for EACH TEAM separately using their configured Twitter sources
 */
async function ensureTweetsExist(match, minRequired = 5) {
  try {
    const matchId = match.match_id;
    const homeTeamId = match.teams?.home?.team_id || match.home_team_id;
    const awayTeamId = match.teams?.away?.team_id || match.away_team_id;
    
    // CRITICAL: Only count tweets that fetchRelevantTweets will actually find
    // fetchRelevantTweets requires: match_id + team_id + reporter type
    const existingCount = await Tweet.countDocuments({
      match_id: matchId,
      team_id: { $in: [homeTeamId, awayTeamId] },
      $or: [
        { 'collection_context.search_type': 'reporter' },
        { 'collection_context.source_priority': 1 }
      ]
    });
    
    console.log(`[ReportPipeline] Found ${existingCount} match-linked reporter tweets for match ${matchId}`);
    
    // If we have enough tweets, skip collection
    if (existingCount >= minRequired) {
      console.log(`[ReportPipeline] ✅ Sufficient tweets available (${existingCount} >= ${minRequired})`);
      return existingCount;
    }
    
    // Check if TwitterAPI is configured
    if (!process.env.TWITTERAPI_KEY) {
      console.log(`[ReportPipeline] ⚠️ TwitterAPI not configured, skipping auto-collection`);
      return existingCount;
    }
    
    // Auto-collect tweets for EACH TEAM using their configured sources
    console.log(`[ReportPipeline] 🐦 Auto-collecting tweets (need ${minRequired}, have ${existingCount})...`);
    
    const collectionStart = Date.now();
    let totalSaved = 0;
    let totalSkipped = 0;
    
    // Define search window
    const matchDate = new Date(match.date);
    const searchStart = new Date(matchDate.getTime() - 2 * 60 * 60 * 1000); // 2h before
    const searchEnd = new Date(matchDate.getTime() + 3 * 60 * 60 * 1000);   // 3h after
    
    // Collect for both teams (only teams with Twitter configured will return tweets)
    for (const teamId of [homeTeamId, awayTeamId]) {
      try {
        // Fetch team data with Twitter configuration
        const team = await Team.findOne({ id: teamId }).lean();
        
        if (!team) {
          console.log(`[ReportPipeline] ⚠️ Team ${teamId} not found, skipping`);
          continue;
        }
        
        // IMPORTANT: For match reports, ONLY use reporter tweets, NOT hashtag tweets
        // Hashtag tweets are for the public team feed only
        if (!team.twitter?.reporters || team.twitter.reporters.length === 0) {
          console.log(`[ReportPipeline] ℹ️ Team ${team.name} has no reporters configured for match reports, skipping`);
          continue;
        }
        
        console.log(`[ReportPipeline] 🔍 Collecting REPORTER tweets for ${team.name}...`);
        console.log(`[ReportPipeline]    Reporters: ${team.twitter.reporters.map(r => r.handle).join(', ')}`);
        
        // Get reporter handles
        const reporterHandles = team.twitter.reporters.map(r => r.handle);
        
        // Use searchByUser to get tweets from reporters only
        const results = await twitterService.searchByUser(reporterHandles, {
          since: searchStart,
          until: searchEnd,
          hashtag: team.twitter.hashtag, // Filter for team-related content
          queryType: 'Latest'
        });
        
        console.log(`[ReportPipeline] Found ${results.tweets.length} reporter tweets for ${team.name}`);
        
        // Save tweets (they already have team_id from searchTeamTweets)
        for (const tweetData of results.tweets.slice(0, 25)) { // Limit per team
          try {
            const existing = await Tweet.findOne({ tweet_id: tweetData.id });
            if (existing) {
              totalSkipped++;
              continue;
            }
            
            // Transform and save with match association
            const tweetDoc = await transformAndSaveTweet(tweetData, team, match);
            if (tweetDoc) totalSaved++;
            
          } catch (error) {
            console.error(`[ReportPipeline] Error saving tweet ${tweetData.id}:`, error.message);
          }
        }
        
      } catch (error) {
        console.error(`[ReportPipeline] Error collecting tweets for team ${teamId}:`, error.message);
      }
    }
    
    const collectionTime = Date.now() - collectionStart;
    console.log(`[ReportPipeline] ✅ Tweet collection complete: ${totalSaved} saved, ${totalSkipped} skipped (${collectionTime}ms)`);
    
    return totalSaved + existingCount;
    
  } catch (error) {
    console.error(`[ReportPipeline] ⚠️ Tweet auto-collection failed:`, error.message);
    // Don't fail the entire pipeline if tweet collection fails
    return 0;
  }
}

/**
 * Transform TwitterAPI.io tweet format to our schema and save
 * IMPORTANT: team_id comes from the configured source (team parameter or collection_context)
 * No content analysis needed - the admin configuration defines team association
 */
async function transformAndSaveTweet(tweetData, team = null, match = null) {
  try {
    const hashtags = tweetData.entities?.hashtags?.map(h => ({
      text: h.text,
      indices: h.indices
    })) || [];

    const userMentions = tweetData.entities?.user_mentions?.map(m => ({
      name: m.name,
      screen_name: m.screen_name,
      id_str: m.id_str,
      indices: m.indices
    })) || [];

    const urls = tweetData.entities?.urls?.map(u => ({
      display_url: u.display_url,
      expanded_url: u.expanded_url,
      url: u.url,
      indices: u.indices
    })) || [];

    const text = tweetData.text?.toLowerCase() || '';
    const isMatchRelated = match !== null || 
      text.includes(' vs ') || 
      text.includes(' v ') || 
      text.includes('goal') ||
      text.includes('match') ||
      text.includes('game');

    // Team ID comes from configured source - either direct team param or collection_context
    const teamId = team?.id || tweetData.collection_context?.team_id;
    const teamSlug = team?.slug || tweetData.collection_context?.team_slug;
    const teamName = team?.name || tweetData.collection_context?.team_name;

    // Check if tweet is from a configured reporter
    const isReporterTweet = team?.twitter?.reporters?.some(reporter => {
      const reporterHandle = reporter.handle.replace('@', '').toLowerCase();
      const tweetAuthor = tweetData.author?.userName?.toLowerCase();
      return reporterHandle === tweetAuthor;
    }) || false;

    // Calculate match phase based on tweet timestamp relative to match time
    let matchPhase = 'general';
    if (match && match.date) {
      const matchTime = new Date(match.date);
      const tweetTime = new Date(tweetData.createdAt);
      const hoursDiff = (tweetTime - matchTime) / (1000 * 60 * 60);
      
      if (hoursDiff < -2) {
        matchPhase = 'pre_match';
      } else if (hoursDiff >= -2 && hoursDiff <= 2) {
        matchPhase = 'live_match';
      } else if (hoursDiff > 2 && hoursDiff <= 6) {
        matchPhase = 'post_match';
      } else {
        matchPhase = 'general';
      }
    }

    const tweetDoc = new Tweet({
      tweet_id: tweetData.id,
      text: tweetData.text,
      url: tweetData.url,
      
      author: {
        id: tweetData.author?.id,
        userName: tweetData.author?.userName,
        name: tweetData.author?.name,
        profilePicture: tweetData.author?.profilePicture,
        description: tweetData.author?.description,
        followers: tweetData.author?.followers,
        following: tweetData.author?.following,
        isBlueVerified: tweetData.author?.isBlueVerified,
        verifiedType: tweetData.author?.verifiedType
      },
      
      created_at: new Date(tweetData.createdAt),
      
      retweetCount: tweetData.retweetCount || 0,
      replyCount: tweetData.replyCount || 0,
      likeCount: tweetData.likeCount || 0,
      quoteCount: tweetData.quoteCount || 0,
      viewCount: tweetData.viewCount || 0,
      bookmarkCount: tweetData.bookmarkCount || 0,
      
      lang: tweetData.lang,
      source: tweetData.source,
      isReply: tweetData.isReply || false,
      inReplyToId: tweetData.inReplyToId,
      inReplyToUserId: tweetData.inReplyToUserId,
      inReplyToUsername: tweetData.inReplyToUsername,
      conversationId: tweetData.conversationId,
      
      entities: {
        hashtags,
        urls,
        user_mentions: userMentions
      },
      
      // Team association from configured source
      team_id: teamId,
      team_slug: teamSlug,
      team_name: teamName,
      
      // Match association
      match_id: match?.match_id || tweetData.collection_context?.match_id,
      match_date: match?.date || tweetData.collection_context?.match_date,
      
      collection_context: {
        search_query: tweetData.collection_context?.search_query || '',
        search_type: isReporterTweet ? 'reporter' : (tweetData.collection_context?.search_type || 'team_source'),
        relevance_score: 0.5,
        collected_for: matchPhase,  // Use calculated match phase
        tags: [],
        source_priority: isReporterTweet ? 1 : (tweetData.collection_context?.source_priority || 2)
      },
      
      analysis: {
        sentiment: 'neutral',
        topics: [],
        mentions_players: [],
        mentions_teams: [],
        is_match_related: isMatchRelated,
        is_news_worthy: false
      },
      
      status: 'raw',
      api_source: 'twitterapi.io',
      api_response_meta: {
        collected_at: new Date(),
        original_response: tweetData
      }
    });

    return await tweetDoc.save();
  } catch (error) {
    console.error('[ReportPipeline] Error transforming tweet:', error);
    throw error;
  }
}

/**
 * Fetch relevant tweets for this match
 * IMPORTANT: Only fetches tweets for the SPECIFIC TEAM to avoid bias
 */
async function fetchRelevantTweets(match, team, teamSide) {
  try {
    const matchStart = new Date(match.date);
    const matchDurationMinutes = 90 +
      (match.match_info?.time_added?.first_half || 0) +
      (match.match_info?.time_added?.second_half || 0);
    const matchEnd = new Date(matchStart.getTime() + matchDurationMinutes * 60 * 1000);
    
    // For post-match reports, extend window to include reporter interviews/analysis
    // Reporters typically post match commentary, then post-match interviews 30min-2hrs after
    const reporterExtendedEnd = new Date(matchEnd.getTime() + 2 * 60 * 60 * 1000); // +2 hours
    
    const matchId = match.match_id;
    
    // Determine which team we're generating report for
    const reportTeamId = teamSide === 'home' 
      ? (match.teams?.home?.team_id || match.home_team_id)
      : (match.teams?.away?.team_id || match.away_team_id);
    
    // CRITICAL: Only fetch REPORTER tweets for THIS TEAM to avoid opponent bias
    // Use extended window for reporter tweets (post-match interviews valuable for finished matches)
    const tweets = await Tweet.find({
      match_id: matchId,
      team_id: reportTeamId,  // ← Only this team's tweets
      created_at: { $gte: matchStart, $lte: reporterExtendedEnd },  // Extended for reporters
      // ONLY reporter tweets - hashtag tweets are for public feed, not match reports
      $or: [
        { 'collection_context.search_type': 'reporter' },
        { 'collection_context.source_priority': 1 }
      ]
    })
      .sort({ 
        'collection_context.source_priority': 1,  // Reporter tweets first
        created_at: 1 
      })
      .limit(15)
      .lean();
    
    console.log(`[ReportPipeline] Fetched ${tweets.length} tweets for team ${reportTeamId} (${teamSide})`);
    
    if (tweets.length === 0) {
      console.log(`[ReportPipeline] ⚠️ No tweets found for team ${reportTeamId} - report will be generated without social context`);
    }
    
    return tweets || [];
  } catch (error) {
    console.error('[ReportPipeline] Error fetching tweets:', error);
    return [];
  }
}

/**
 * Extract competition context
 */
function getCompetitionContext(match) {
  const league = match.match_info?.league;
  const stage = match.match_info?.stage;
  
  if (!league) {
    return {
      name: 'Unknown Competition',
      stage: 'Unknown Stage',
      is_cup: false,
      affects_league: true
    };
  }
  
  const competitionName = league.name || 'Unknown Competition';
  const stageName = stage?.name || 'Unknown Stage';
  
  const isCup = competitionName.toLowerCase().includes('cup') ||
                competitionName.toLowerCase().includes('carabao') ||
                competitionName.toLowerCase().includes('fa cup') ||
                league.id === 27;
  
  return {
    name: competitionName,
    stage: stageName,
    is_cup: isCup,
    affects_league: !isCup
  };
}

/**
 * Determine Player of the Match from pre-calculated data
 */
function determinePOTM(match, teamSide) {
  // First, check if POTM is already calculated in the match document
  if (match.potm && match.potm[teamSide]) {
    const potmData = match.potm[teamSide];
    return {
      player: potmData.player,
      rating: potmData.rating,
      reason: potmData.reason || `Highest rating (${potmData.rating})`
    };
  }
  
  // Fallback: Try to determine from player_ratings array
  const ratings = match.player_ratings || [];
  
  if (!ratings.length) {
    return { player: null, rating: null, reason: 'No ratings available' };
  }
  
  // Determine team_id for the focused side
  const teamId = teamSide === 'home' 
    ? (match.teams?.home?.team_id || match.home_team_id)
    : (match.teams?.away?.team_id || match.away_team_id);
  
  // Find highest-rated player for the focused team
  const teamRatings = ratings
    .filter(r => r.rating && typeof r.rating === 'number' && r.team_id === teamId)
    .map(r => ({
      player: r.player || r.player_name,
      rating: r.rating,
      team_id: r.team_id
    }))
    .sort((a, b) => b.rating - a.rating);
  
  if (teamRatings.length === 0) {
    return { player: null, rating: null, reason: 'No valid ratings' };
  }
  
  const topPlayer = teamRatings[0];
  
  return {
    player: topPlayer.player,
    rating: topPlayer.rating,
    reason: `Highest rating (${topPlayer.rating})`
  };
}

/**
 * Enrich the generated report with embedded tweets and metadata
 */
function enrichReport({ report, interpretation, match, team, teamFocus, tweets, competitionContext }) {
  // Select tweets for frontend embedding (max 2-3)
  const embeddedTweets = [];
  
  if (interpretation.selected_tweets && interpretation.selected_tweets.length > 0) {
    // Find the actual tweet objects based on interpretation selection
    for (const selectedTweet of interpretation.selected_tweets.slice(0, 3)) {
      // selectedTweet is now an object with {text, why_selected}
      const tweetText = selectedTweet.text || selectedTweet; // Handle both object and string formats
      
      // Try exact match first
      let tweetObj = tweets.find(t => t.text === tweetText);
      
      // If no exact match, use fuzzy matching (AI often slightly modifies text)
      if (!tweetObj && tweetText.length >= 15) {
        // Normalize: remove extra spaces, lowercase for comparison
        const normalizedSearch = tweetText.toLowerCase().replace(/\s+/g, ' ').trim();
        
        // Extract key distinctive words (skip common words)
        const keyWords = normalizedSearch.split(' ')
          .filter(w => w.length > 3 && !['goal', 'the', 'and', 'for', 'with'].includes(w))
          .slice(0, 5); // Use first 5 key words
        
        // Find tweet containing most key words (fuzzy match)
        if (keyWords.length > 0) {
          const scoredTweets = tweets.map(t => {
            const normalizedTweet = t.text.toLowerCase().replace(/\s+/g, ' ').trim();
            const matchingWords = keyWords.filter(kw => normalizedTweet.includes(kw)).length;
            return { tweet: t, score: matchingWords };
          }).filter(st => st.score >= Math.min(3, keyWords.length)); // At least 3 words or all if fewer
          
          if (scoredTweets.length > 0) {
            // Pick the one with highest score
            scoredTweets.sort((a, b) => b.score - a.score);
            tweetObj = scoredTweets[0].tweet;
            console.log(`[ReportPipeline] 🔍 Fuzzy matched tweet with score ${scoredTweets[0].score}/${keyWords.length} for: "${tweetText.substring(0, 40)}..."`);
          }
        }
      }
      
      if (tweetObj) {
        embeddedTweets.push({
          tweet_id: tweetObj.tweet_id,
          text: tweetObj.text,
          author: {
            name: tweetObj.author?.name || tweetObj.author?.userName,
            userName: tweetObj.author?.userName,
            profilePicture: tweetObj.author?.profilePicture,
            isBlueVerified: tweetObj.author?.isBlueVerified || false
          },
          created_at: tweetObj.created_at,
          engagement: {
            likes: tweetObj.likeCount || 0,
            retweets: tweetObj.retweetCount || 0,
            replies: tweetObj.replyCount || 0
          },
          url: tweetObj.url || `https://twitter.com/i/status/${tweetObj.tweet_id}`,
          embed_context: selectedTweet.why_selected || 'social_commentary',
          placement_hint: 'after_summary'
        });
      } else {
        console.log(`[ReportPipeline] ⚠️ Could not find tweet object for text: ${tweetText.substring(0, 50)}...`);
      }
    }
    
    console.log(`[ReportPipeline] 🐦 Embedded ${embeddedTweets.length} tweets for frontend display`);
  }
  
  // Add enrichments
  return {
    ...report,
    embedded_tweets: embeddedTweets,
    match_id: match.match_id,
    team_slug: team?.slug || teamFocus.toLowerCase().replace(/\s+/g, '-'),
    team_name: teamFocus,
    competition: {
      name: competitionContext.name,
      stage: competitionContext.stage,
      is_cup: competitionContext.is_cup
    }
  };
}

/**
 * Save interpretation for debugging/analysis (optional)
 */
async function saveInterpretation(matchId, teamSlug, interpretation) {
  // Could save to a separate Interpretation collection for analysis
  // For now, just log it
  console.log(`[ReportPipeline] Interpretation for ${matchId}/${teamSlug}:`, JSON.stringify(interpretation, null, 2));
  
  // Optional: Save to database
  // const Interpretation = require('../models/Interpretation');
  // await Interpretation.create({ match_id: matchId, team_slug: teamSlug, data: interpretation });
}

module.exports = {
  generateReportPipeline
};
