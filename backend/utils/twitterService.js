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
      const sinceDate = new Date(options.since).toISOString().split('T')[0];
      query += ` since:${sinceDate}`;
    }
    
    if (options.until) {
      const untilDate = new Date(options.until).toISOString().split('T')[0];
      query += ` until:${untilDate}`;
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
    if (options.keywords) {
      const keywords = Array.isArray(options.keywords) ? options.keywords : [options.keywords];
      const keywordQuery = keywords.map(kw => `"${kw}"`).join(' OR ');
      query += ` (${keywordQuery})`;
    }
    
    if (options.since) {
      const sinceDate = new Date(options.since).toISOString().split('T')[0];
      query += ` since:${sinceDate}`;
    }
    
    if (options.until) {
      const untilDate = new Date(options.until).toISOString().split('T')[0];
      query += ` until:${untilDate}`;
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
    
    // Search by team hashtag
    if (teamData.twitter?.hashtag) {
      searches.push(this.searchByHashtag(teamData.twitter.hashtag, options));
    }
    
    // Search by team reporters
    if (teamData.twitter?.reporters && teamData.twitter.reporters.length > 0) {
      const reporterHandles = teamData.twitter.reporters.map(r => r.handle);
      searches.push(this.searchByUser(reporterHandles, {
        ...options,
        keywords: [teamData.name, teamData.short_code].filter(Boolean)
      }));
    }
    
    // Search by team name mentions
    if (teamData.name) {
      searches.push(this.searchTweets(`"${teamData.name}"`, options));
    }

    // Execute all searches in parallel
    const results = await Promise.allSettled(searches);
    
    // Combine results and remove duplicates
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
                search_type: 'team_search',
                team_id: teamData.id,
                team_slug: teamData.slug,
                team_name: teamData.name
              }
            });
          }
        });
      }
    });

    // Sort by engagement and recency
    allTweets.sort((a, b) => {
      const aEngagement = (a.likeCount || 0) + (a.retweetCount || 0) + (a.replyCount || 0);
      const bEngagement = (b.likeCount || 0) + (b.retweetCount || 0) + (b.replyCount || 0);
      
      if (aEngagement !== bEngagement) {
        return bEngagement - aEngagement; // Higher engagement first
      }
      
      // If engagement is similar, prefer more recent tweets
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
    const homeTeam = matchData.home_team;
    const awayTeam = matchData.away_team;
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