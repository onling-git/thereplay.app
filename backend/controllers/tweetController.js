// controllers/tweetController.js
const Tweet = require('../models/Tweet');
const Team = require('../models/Team');
const Match = require('../models/Match');
const twitterService = require('../utils/twitterService');

/**
 * Get tweets for a specific team
 * GET /api/tweets/team/:teamSlug
 */
exports.getTeamTweets = async (req, res) => {
  try {
    const { teamSlug } = req.params;
    const { 
      limit = 20, 
      skip = 0, 
      sentiment,
      matchRelated,
      feedType,
      since,
      until 
    } = req.query;

    // Find team
    const team = await Team.findOne({ slug: teamSlug }).lean();
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Build query
    const query = { team_id: team.id };
    
    // Filter by feed type if specified
    if (feedType === 'team_feed') {
      query['collection_context.collected_for'] = 'team_feed';
      // Team feed: ONLY hashtag-based tweets (exclude old reporter/keyword tweets)
      query['collection_context.search_type'] = 'hashtag';
    } else if (feedType === 'match') {
      query['collection_context.collected_for'] = { $in: ['pre_match', 'live_match', 'post_match'] };
    }
    
    if (sentiment && ['positive', 'negative', 'neutral'].includes(sentiment)) {
      query['analysis.sentiment'] = sentiment;
    }
    
    if (matchRelated === 'true') {
      query['analysis.is_match_related'] = true;
    }
    
    if (since || until) {
      query.created_at = {};
      if (since) query.created_at.$gte = new Date(since);
      if (until) query.created_at.$lte = new Date(until);
    }

    const tweets = await Tweet.find(query)
      .sort({ created_at: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    const total = await Tweet.countDocuments(query);

    res.json({
      tweets,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit)
      },
      team: {
        id: team.id,
        name: team.name,
        slug: team.slug
      }
    });

  } catch (error) {
    console.error('Error fetching team tweets:', error);
    res.status(500).json({ error: 'Failed to fetch tweets', detail: error.message });
  }
};

/**
 * Get tweets for a specific match
 * GET /api/tweets/match/:matchId
 */
exports.getMatchTweets = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { limit = 20, skip = 0 } = req.query;

    const tweets = await Tweet.find({ match_id: parseInt(matchId) })
      .sort({ created_at: -1 })
      .skip(parseInt(skip))
      .limit(parseInt(limit))
      .lean();

    const total = await Tweet.countDocuments({ match_id: parseInt(matchId) });

    res.json({
      tweets,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip),
        hasMore: total > parseInt(skip) + parseInt(limit)
      },
      match_id: parseInt(matchId)
    });

  } catch (error) {
    console.error('Error fetching match tweets:', error);
    res.status(500).json({ error: 'Failed to fetch match tweets', detail: error.message });
  }
};

/**
 * Collect tweets for a specific team
 * POST /api/tweets/collect/team/:teamSlug
 */
exports.collectTeamTweets = async (req, res) => {
  try {
    const { teamSlug } = req.params;
    const { 
      hours = 24,
      maxTweets = 50,
      queryType = 'Latest' 
    } = req.body;

    // Find team
    const team = await Team.findOne({ slug: teamSlug });
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (!team.twitter || !team.twitter.tweet_fetch_enabled) {
      return res.status(400).json({ 
        error: 'Tweet collection not enabled for this team',
        team: { name: team.name, slug: team.slug }
      });
    }

    console.log(`🐦 Starting tweet collection for ${team.name}`);

    // Set up search options
    const searchOptions = {
      queryType,
      since: new Date(Date.now() - hours * 60 * 60 * 1000),
      lang: 'en'
    };

    // Collect tweets using TwitterService
    const results = await twitterService.searchTeamTweets(team, searchOptions);
    
    let saved = 0;
    let skipped = 0;
    const errors = [];

    // Separate tweets by priority - save ALL reporter tweets regardless of limit
    const reporterTweets = results.tweets.filter(t => 
      t.collection_context?.search_type === 'reporter' || 
      t.collection_context?.source_priority === 1
    );
    const otherTweets = results.tweets.filter(t => 
      t.collection_context?.search_type !== 'reporter' && 
      t.collection_context?.source_priority !== 1
    );

    console.log(`📊 Tweet breakdown - Reporter: ${reporterTweets.length}, Other: ${otherTweets.length}`);

    // Process ALL reporter tweets first (no limit)
    for (const tweetData of reporterTweets) {
      try {
        const existingTweet = await Tweet.findOne({ tweet_id: tweetData.id });
        if (existingTweet) {
          skipped++;
          continue;
        }

        const tweetDoc = await transformAndSaveTweet(tweetData, team);
        if (tweetDoc) {
          saved++;
        }

      } catch (error) {
        console.error(`Error saving reporter tweet ${tweetData.id}:`, error);
        errors.push({
          tweet_id: tweetData.id,
          error: error.message
        });
      }
    }

    // Then process other tweets up to the remaining limit
    const remainingSlots = Math.max(0, maxTweets - saved);
    for (const tweetData of otherTweets.slice(0, remainingSlots)) {
      try {
        const existingTweet = await Tweet.findOne({ tweet_id: tweetData.id });
        if (existingTweet) {
          skipped++;
          continue;
        }

        const tweetDoc = await transformAndSaveTweet(tweetData, team);
        if (tweetDoc) {
          saved++;
        }

      } catch (error) {
        console.error(`Error saving tweet ${tweetData.id}:`, error);
        errors.push({
          tweet_id: tweetData.id,
          error: error.message
        });
      }
    }

    // Update team's last fetch time
    await Team.findByIdAndUpdate(team._id, {
      'twitter.last_tweet_fetch': new Date()
    });

    console.log(`✅ Tweet collection complete for ${team.name}: ${saved} saved, ${skipped} skipped`);

    res.json({
      success: true,
      team: { name: team.name, slug: team.slug },
      collection: {
        total_found: results.tweets.length,
        saved,
        skipped,
        errors: errors.length,
        error_details: errors.slice(0, 5) // Only return first 5 errors
      },
      searches: {
        total: results.totalSearches,
        successful: results.successfulSearches
      }
    });

  } catch (error) {
    console.error('Error collecting team tweets:', error);
    res.status(500).json({ error: 'Failed to collect tweets', detail: error.message });
  }
};

/**
 * Collect tweets for a specific match
 * POST /api/tweets/collect/match/:matchId
 */
exports.collectMatchTweets = async (req, res) => {
  try {
    const { matchId } = req.params;
    const { 
      preMatchHours = 2,
      postMatchHours = 3,
      maxTweets = 100,
      queryType = 'Latest'
    } = req.body;

    // Find match
    const match = await Match.findOne({ match_id: parseInt(matchId) }).lean();
    if (!match) {
      return res.status(404).json({ error: 'Match not found' });
    }

    console.log(`🐦 Starting tweet collection for match ${match.teams?.home?.team_name || match.home_team || 'Unknown'} vs ${match.teams?.away?.team_name || match.away_team || 'Unknown'}`);

    // Collect tweets using TwitterService
    const results = await twitterService.searchMatchTweets(match, {
      preMatchHours,
      postMatchHours,
      queryType
    });

    let saved = 0;
    let skipped = 0;
    const errors = [];

    // Process and save tweets
    for (const tweetData of results.tweets.slice(0, maxTweets)) {
      try {
        // Check if tweet already exists
        const existingTweet = await Tweet.findOne({ tweet_id: tweetData.id });
        if (existingTweet) {
          skipped++;
          continue;
        }

        // Transform and save tweet
        const tweetDoc = await transformAndSaveTweet(tweetData, null, match);
        if (tweetDoc) {
          saved++;
        }

      } catch (error) {
        console.error(`Error saving tweet ${tweetData.id}:`, error);
        errors.push({
          tweet_id: tweetData.id,
          error: error.message
        });
      }
    }

    console.log(`✅ Tweet collection complete for match ${matchId}: ${saved} saved, ${skipped} skipped`);

    res.json({
      success: true,
      match: {
        match_id: match.match_id,
        home_team: match.teams?.home?.team_name || match.home_team,
        away_team: match.teams?.away?.team_name || match.away_team,
        date: match.date
      },
      collection: {
        total_found: results.tweets.length,
        saved,
        skipped,
        errors: errors.length,
        error_details: errors.slice(0, 5)
      }
    });

  } catch (error) {
    console.error('Error collecting match tweets:', error);
    res.status(500).json({ error: 'Failed to collect match tweets', detail: error.message });
  }
};

/**
 * Get tweet collection stats
 * GET /api/tweets/stats
 */
exports.getTweetStats = async (req, res) => {
  try {
    const stats = await Promise.all([
      Tweet.countDocuments(),
      Tweet.countDocuments({ 'analysis.is_match_related': true }),
      Tweet.countDocuments({ status: 'processed' }),
      Tweet.aggregate([
        { $group: { _id: '$team_id', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      Tweet.aggregate([
        { $group: { _id: '$analysis.sentiment', count: { $sum: 1 } } }
      ])
    ]);

    const [
      totalTweets,
      matchRelatedTweets,
      processedTweets,
      topTeams,
      sentimentBreakdown
    ] = stats;

    // Get team names for top teams
    const teamIds = topTeams.map(t => t._id).filter(id => id);
    const teams = await Team.find({ id: { $in: teamIds } }, 'id name').lean();
    const teamMap = teams.reduce((acc, team) => {
      acc[team.id] = team.name;
      return acc;
    }, {});

    const topTeamsWithNames = topTeams.map(t => ({
      team_id: t._id,
      team_name: teamMap[t._id] || 'Unknown Team',
      tweet_count: t.count
    }));

    res.json({
      overview: {
        total_tweets: totalTweets,
        match_related_tweets: matchRelatedTweets,
        processed_tweets: processedTweets,
        processing_rate: totalTweets > 0 ? (processedTweets / totalTweets * 100).toFixed(1) : 0
      },
      top_teams: topTeamsWithNames,
      sentiment_breakdown: sentimentBreakdown.reduce((acc, s) => {
        acc[s._id || 'unknown'] = s.count;
        return acc;
      }, {}),
      twitter_service: twitterService.getUsageStats()
    });

  } catch (error) {
    console.error('Error fetching tweet stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats', detail: error.message });
  }
};

/**
 * Transform TwitterAPI.io tweet format to our schema and save
 */
async function transformAndSaveTweet(tweetData, team = null, match = null) {
  try {
    // Extract hashtags from entities
    const hashtags = tweetData.entities?.hashtags?.map(h => ({
      text: h.text,
      indices: h.indices
    })) || [];

    // Extract mentions
    const userMentions = tweetData.entities?.user_mentions?.map(m => ({
      name: m.name,
      screen_name: m.screen_name,
      id_str: m.id_str,
      indices: m.indices
    })) || [];

    // Extract URLs
    const urls = tweetData.entities?.urls?.map(u => ({
      display_url: u.display_url,
      expanded_url: u.expanded_url,
      url: u.url,
      indices: u.indices
    })) || [];

    // Extract media from entities (TwitterAPI.io uses extendedEntities for media)
    const extractMedia = (tweetObj) => {
      // Check extendedEntities.media first (preferred), then entities.media
      let mediaArray = tweetObj?.extendedEntities?.media || tweetObj?.entities?.media;
      
      if (!mediaArray || !Array.isArray(mediaArray)) return [];
      
      return mediaArray.map(m => ({
        type: m.type,
        url: m.url || m.media_url_https,
        media_url_https: m.media_url_https,
        display_url: m.display_url,
        expanded_url: m.expanded_url,
        sizes: m.sizes
      }));
    };

    const media = extractMedia(tweetData);

    // Extract retweeted tweet if this is a retweet (TwitterAPI.io uses retweeted_tweet)
    let retweetedTweet = null;
    const isRetweet = !!tweetData.retweeted_tweet;
    if (isRetweet && tweetData.retweeted_tweet) {
      const rt = tweetData.retweeted_tweet;
      retweetedTweet = {
        tweet_id: rt.id,
        text: rt.text,
        author: {
          id: rt.author?.id,
          userName: rt.author?.userName,
          name: rt.author?.name,
          profilePicture: rt.author?.profilePicture,
          isBlueVerified: rt.author?.isBlueVerified,
          verifiedType: rt.author?.verifiedType
        },
        created_at: rt.createdAt ? new Date(rt.createdAt) : undefined,
        media: extractMedia(rt),
        retweetCount: rt.retweetCount,
        replyCount: rt.replyCount,
        likeCount: rt.likeCount
      };
    }

    // Extract quoted tweet if this is a quote tweet (TwitterAPI.io uses quoted_tweet)
    let quotedTweet = null;
    const isQuote = !!tweetData.quoted_tweet;
    if (isQuote && tweetData.quoted_tweet) {
      const qt = tweetData.quoted_tweet;
      quotedTweet = {
        tweet_id: qt.id,
        text: qt.text,
        author: {
          id: qt.author?.id,
          userName: qt.author?.userName,
          name: qt.author?.name,
          profilePicture: qt.author?.profilePicture,
          isBlueVerified: qt.author?.isBlueVerified,
          verifiedType: qt.author?.verifiedType
        },
        created_at: qt.createdAt ? new Date(qt.createdAt) : undefined,
        media: extractMedia(qt),
        url: qt.url
      };
    }

    // Basic content analysis
    const text = tweetData.text?.toLowerCase() || '';
    const isMatchRelated = match !== null || 
      text.includes(' vs ') || 
      text.includes(' v ') || 
      text.includes('goal') ||
      text.includes('match') ||
      text.includes('game');

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
        user_mentions: userMentions,
        media
      },
      
      // Media attachments
      media,
      
      // Retweet information
      isRetweet,
      retweetedTweet,
      
      // Quote tweet information
      isQuote,
      quotedTweet,
      
      // Team association
      team_id: team?.id || tweetData.collection_context?.team_id,
      team_slug: team?.slug || tweetData.collection_context?.team_slug,
      team_name: team?.name || tweetData.collection_context?.team_name,
      
      // Match association
      match_id: match?.match_id || tweetData.collection_context?.match_id,
      match_date: match?.date || tweetData.collection_context?.match_date,
      
      collection_context: {
        search_query: tweetData.collection_context?.search_query || '',
        search_type: tweetData.collection_context?.search_type || 'mixed',
        relevance_score: 0.5, // Will be improved with better analysis
        collected_for: tweetData.collection_context?.collected_for || 'general',
        tags: []
      },
      
      analysis: {
        sentiment: 'neutral', // Will be improved with sentiment analysis
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

    const savedTweet = await tweetDoc.save();
    return savedTweet;

  } catch (error) {
    console.error('Error transforming tweet:', error);
    throw error;
  }
}

module.exports = {
  getTeamTweets: exports.getTeamTweets,
  getMatchTweets: exports.getMatchTweets,
  collectTeamTweets: exports.collectTeamTweets,
  collectMatchTweets: exports.collectMatchTweets,
  getTweetStats: exports.getTweetStats,
  transformAndSaveTweet
};