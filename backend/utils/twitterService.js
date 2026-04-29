// utils/twitterService.js
const axios = require('axios');

class TwitterService {
  constructor() {
    this.baseURL = 'https://api.twitterapi.io';
    this.apiKey = process.env.TWITTERAPI_KEY;
    
    if (!this.apiKey) {
      console.warn('⚠️ TWITTERAPI_KEY not set in environment variables');
    }
    
    // Rate limiting tracking
    this.requestQueue = [];
    this.lastRequestTime = 0;
    this.minRequestInterval = 100; // 100ms between requests to respect rate limits
  }

  /**
   * Make a rate-limited request to TwitterAPI.io
   */
  async makeRequest(endpoint, params = {}) {
    if (!this.apiKey) {
      throw new Error('TwitterAPI key not configured');
    }

    // Simple rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise(resolve => 
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }

    try {
      const response = await axios.get(`${this.baseURL}${endpoint}`, {
        headers: {
          'X-API-Key': this.apiKey,
          'Content-Type': 'application/json'
        },
        params,
        timeout: 10000 // 10 second timeout
      });

      this.lastRequestTime = Date.now();
      return response.data;
    } catch (error) {
      console.error('TwitterAPI request failed:', {
        endpoint,
        params,
        error: error.response?.data || error.message
      });
      
      // Re-throw with more context
      const errorMessage = error.response?.data?.message || error.message;
      const errorCode = error.response?.status || 'UNKNOWN';
      throw new Error(`TwitterAPI Error (${errorCode}): ${errorMessage}`);
    }
  }

  /**
   * Search tweets using advanced search
   * @param {string} query - Search query (hashtags, keywords, from:user, etc.)
   * @param {object} options - Search options
   * @returns {Promise<object>} - Search results with tweets and pagination
   */
  async searchTweets(query, options = {}) {
    const params = {
      query,
      queryType: options.queryType || 'Latest', // 'Latest' or 'Top'
      cursor: options.cursor || ''
    };

    const result = await this.makeRequest('/twitter/tweet/advanced_search', params);
    
    return {
      tweets: result.tweets || [],
      hasNextPage: result.has_next_page || false,
      nextCursor: result.next_cursor || '',
      searchQuery: query,
      queryType: params.queryType
    };
  }

  /**
   * Search tweets by hashtag
   * @param {string} hashtag - Hashtag to search (with or without #)
   * @param {object} options - Search options
   */
  async searchByHashtag(hashtag, options = {}) {
    // Ensure hashtag starts with #
    const formattedHashtag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
    
    // Build query with additional filters if provided
    let query = formattedHashtag;
    
    if (options.since) {
      // Twitter's since: operator uses dates (YYYY-MM-DD) and includes tweets from 00:00:00 UTC on that date
      const sinceDate = new Date(options.since).toISOString().split('T')[0];
      query += ` since:${sinceDate}`;
    }
    
    if (options.until) {
      // Twitter's until: operator is EXCLUSIVE - it searches UP TO but NOT INCLUDING this date
      // So we need to add 1 day to include tweets from the until date
      const untilDate = new Date(options.until);
      const untilNextDay = new Date(untilDate.getTime() + 24 * 60 * 60 * 1000);
      query += ` until:${untilNextDay.toISOString().split('T')[0]}`;
    }
    
    if (options.lang) {
      query += ` lang:${options.lang}`;
    }

    return this.searchTweets(query, options);
  }

  /**
   * Search tweets from specific users
   * @param {string|array} usernames - Username(s) to search from
   * @param {object} options - Search options
   */
  async searchByUser(usernames, options = {}) {
    const users = Array.isArray(usernames) ? usernames : [usernames];
    
    // Remove @ symbols if present
    const cleanUsers = users.map(user => user.replace('@', ''));
    
    // Build query for multiple users
    const userQuery = cleanUsers.map(user => `from:${user}`).join(' OR ');
    
    let query = `(${userQuery})`;
    
    // Add additional filters
    if (options.hashtag) {
      // Add hashtag filter for reporter tweets during matches
      const formattedHashtag = options.hashtag.startsWith('#') ? options.hashtag : `#${options.hashtag}`;
      query += ` ${formattedHashtag}`;
    } else if (options.keywords) {
      const keywords = Array.isArray(options.keywords) ? options.keywords : [options.keywords];
      const keywordQuery = keywords.map(kw => `"${kw}"`).join(' OR ');
      query += ` (${keywordQuery})`;
    }
    
    if (options.since) {
      // Twitter's since: operator uses dates (YYYY-MM-DD) and includes tweets from 00:00:00 UTC on that date
      const sinceDate = new Date(options.since).toISOString().split('T')[0];
      query += ` since:${sinceDate}`;
    }
    
    if (options.until) {
      // Twitter's until: operator is EXCLUSIVE - it searches UP TO but NOT INCLUDING this date
      // So we need to add 1 day to include tweets from the until date
      const untilDate = new Date(options.until);
      const untilNextDay = new Date(untilDate.getTime() + 24 * 60 * 60 * 1000);
      query += ` until:${untilNextDay.toISOString().split('T')[0]}`;
    }

    return this.searchTweets(query, options);
  }

  /**
   * Search tweets related to a team
   * @param {object} teamData - Team data including name, hashtag, reporters
   * @param {object} options - Search options
   */
  async searchTeamTweets(teamData, options = {}) {
    const searches = [];
    
    // Team feed: ONLY hashtag-based tweets
    // Reporters are only used for match reports, not the general team feed
    
    // Collect all team hashtags (primary + alternatives)
    const allHashtags = [];
    
    // Add primary hashtag if exists
    if (teamData.twitter?.hashtag) {
      allHashtags.push(teamData.twitter.hashtag);
    }
    
    // Add alternative hashtags if they exist
    if (teamData.twitter?.alternative_hashtags && Array.isArray(teamData.twitter.alternative_hashtags)) {
      allHashtags.push(...teamData.twitter.alternative_hashtags);
    }
    
    // If no hashtags configured, return empty result
    if (allHashtags.length === 0) {
      console.log(`⚠️ No hashtags configured for ${teamData.name} - skipping tweet collection`);
      return {
        tweets: [],
        searchQuery: 'none'
      };
    }
    
    // Create a search for each hashtag
    allHashtags.forEach((hashtag, index) => {
      searches.push({
        promise: this.searchByHashtag(hashtag, options),
        source_type: 'hashtag',
        priority: index + 1, // Primary hashtag has priority 1
        hashtag
      });
    });

    // Execute all searches in parallel
    const results = await Promise.allSettled(searches.map(s => s.promise));
    
    // Combine results and remove duplicates, tracking source
    const allTweets = [];
    const seenTweetIds = new Set();
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.tweets) {
        const searchInfo = searches[index];
        result.value.tweets.forEach(tweet => {
          if (!seenTweetIds.has(tweet.id)) {
            seenTweetIds.add(tweet.id);
            allTweets.push({
              ...tweet,
              collection_context: {
                search_query: result.value.searchQuery,
                search_type: searchInfo.source_type, // 'reporter', 'hashtag', or 'keyword'
                collected_for: 'team_feed', // So tweets appear in team feed filter
                team_id: teamData.id,
                team_slug: teamData.slug,
                team_name: teamData.name,
                source_priority: searchInfo.priority
              }
            });
          }
        });
      }
    });

    // Sort by source priority first (reporters > hashtags > keywords), then engagement
    allTweets.sort((a, b) => {
      // First priority: source type (lower priority number = higher priority)
      const aPriority = a.collection_context?.source_priority || 999;
      const bPriority = b.collection_context?.source_priority || 999;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority; // Lower priority number first (reporters first)
      }
      
      // Second priority: engagement
      const aEngagement = (a.likeCount || 0) + (a.retweetCount || 0) + (a.replyCount || 0);
      const bEngagement = (b.likeCount || 0) + (b.retweetCount || 0) + (b.replyCount || 0);
      
      if (aEngagement !== bEngagement) {
        return bEngagement - aEngagement; // Higher engagement first within same source type
      }
      
      // Third priority: recency
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    return {
      tweets: allTweets,
      totalSearches: searches.length,
      successfulSearches: results.filter(r => r.status === 'fulfilled').length,
      teamData: {
        id: teamData.id,
        name: teamData.name,
        slug: teamData.slug
      }
    };
  }

  /**
   * Search match-related tweets
   * @param {object} matchData - Match information
   * @param {object} options - Search options
   */
  async searchMatchTweets(matchData, options = {}) {
    const homeTeam = matchData.teams?.home?.team_name || matchData.home_team;
    const awayTeam = matchData.teams?.away?.team_name || matchData.away_team;
    const matchDate = new Date(matchData.date);
    
    // Define search window (2 hours before to 3 hours after match)
    const searchStart = new Date(matchDate.getTime() - (options.preMatchHours || 2) * 60 * 60 * 1000);
    const searchEnd = new Date(matchDate.getTime() + (options.postMatchHours || 3) * 60 * 60 * 1000);
    
    const searches = [
      // Search for both team names together
      this.searchTweets(`"${homeTeam}" "${awayTeam}"`, {
        ...options,
        since: searchStart,
        until: searchEnd
      }),
      
      // Search for match-specific terms
      this.searchTweets(`(${homeTeam} OR ${awayTeam}) (vs OR v OR against)`, {
        ...options,
        since: searchStart,
        until: searchEnd
      })
    ];

    const results = await Promise.allSettled(searches);
    const allTweets = [];
    const seenTweetIds = new Set();
    
    results.forEach(result => {
      if (result.status === 'fulfilled' && result.value.tweets) {
        result.value.tweets.forEach(tweet => {
          if (!seenTweetIds.has(tweet.id)) {
            seenTweetIds.add(tweet.id);
            allTweets.push({
              ...tweet,
              collection_context: {
                search_query: result.value.searchQuery,
                search_type: 'match_search',
                match_id: matchData.match_id,
                match_date: matchData.date,
                collected_for: this.getMatchPhase(matchDate, new Date(tweet.createdAt))
              }
            });
          }
        });
      }
    });

    return {
      tweets: allTweets,
      matchData: {
        match_id: matchData.match_id,
        home_team: homeTeam,
        away_team: awayTeam,
        home_team_id: matchData.teams?.home?.team_id || matchData.home_team_id,
        away_team_id: matchData.teams?.away?.team_id || matchData.away_team_id,
        date: matchData.date
      }
    };
  }

  /**
   * Determine what phase of the match a tweet was posted
   */
  getMatchPhase(matchDate, tweetDate) {
    const matchTime = matchDate.getTime();
    const tweetTime = tweetDate.getTime();
    const diffHours = (tweetTime - matchTime) / (1000 * 60 * 60);
    
    if (diffHours < -2) return 'pre_match';
    if (diffHours < 2) return 'live_match';
    return 'post_match';
  }

  /**
   * Get user information by username
   * @param {string} username - Twitter username (with or without @)
   */
  async getUserInfo(username) {
    const cleanUsername = username.replace('@', '');
    
    try {
      const result = await this.makeRequest('/twitter/user/by_username', {
        userName: cleanUsername
      });
      
      return result;
    } catch (error) {
      console.warn(`Failed to get user info for ${username}:`, error.message);
      return null;
    }
  }

  /**
   * Get rate limit status and usage
   */
  getUsageStats() {
    return {
      apiKeyConfigured: !!this.apiKey,
      lastRequestTime: this.lastRequestTime,
      requestQueueLength: this.requestQueue.length,
      minRequestInterval: this.minRequestInterval
    };
  }
}

// Export singleton instance
module.exports = new TwitterService();