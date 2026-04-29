// utils/teamNewsAggregator.js
const redis = require('redis');
const TeamRssFeedSubscription = require('../models/TeamRssFeedSubscription');
const { fetchRssFeed } = require('./rssAggregator');

// Initialize Redis client (reuse existing connection if available)
let redisClient = null;

const getRedisClient = () => {
  if (!redisClient) {
    redisClient = redis.createClient({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      db: process.env.REDIS_DB || 0
    });

    redisClient.on('error', (err) => {
      console.error('[redis-client] Error:', err);
    });

    redisClient.on('connect', () => {
      console.log('[redis-client] Connected');
    });
  }

  return redisClient;
};

/**
 * Fetch articles for a specific team from its assigned feeds
 * @param {number} teamId - Team ID
 * @param {number} limit - Max articles to return
 * @param {boolean} useCache - Whether to use cached results
 * @returns {Promise<Array>} Articles array
 */
async function getTeamArticles(teamId, limit = 20, useCache = true) {
  try {
    const subscription = await TeamRssFeedSubscription.getWithFeeds(teamId);

    if (!subscription) {
      console.log(`[team-news] No subscription found for team ${teamId}`);
      return [];
    }

    if (!subscription.feeds.length) {
      console.log(`[team-news] No feeds assigned to team ${teamId}`);
      return [];
    }

    // Check cache first if enabled
    const cacheKey = subscription.getCacheKey();
    if (useCache) {
      try {
        const redis = getRedisClient();
        const cached = await redis.get(cacheKey);

        if (cached) {
          console.log(`[team-news] Cache hit for team ${teamId}`);
          const articles = JSON.parse(cached);
          return articles.slice(0, limit);
        }
      } catch (cacheErr) {
        console.warn(`[team-news] Cache read failed for ${cacheKey}:`, cacheErr.message);
        // Continue without cache
      }
    }

    // Fetch from all assigned feeds
    console.log(`[team-news] Fetching from ${subscription.feeds.length} feeds for team ${teamId}`);

    const feedPromises = subscription.feeds.map(feedObj => {
      const feed = feedObj.feedId;
      return fetchRssFeed(feed)
        .then(articles => ({
          feedId: feed._id,
          feedName: feed.name,
          articles: articles || []
        }))
        .catch(err => {
          console.error(`[team-news] Error fetching from feed ${feed.name}:`, err.message);
          return {
            feedId: feed._id,
            feedName: feed.name,
            articles: []
          };
        });
    });

    const feedResults = await Promise.all(feedPromises);

    // Merge and sort by date
    let allArticles = [];
    feedResults.forEach(result => {
      if (result.articles && result.articles.length) {
        allArticles = allArticles.concat(
          result.articles.map(article => ({
            ...article,
            feedId: result.feedId,
            feedName: result.feedName
          }))
        );
      }
    });

    // Sort by published date (newest first)
    allArticles.sort((a, b) => {
      const dateA = new Date(a.publishedAt || a.pubDate || 0).getTime();
      const dateB = new Date(b.publishedAt || b.pubDate || 0).getTime();
      return dateB - dateA;
    });

    // Cache the results
    try {
      const redis = getRedisClient();
      const ttl = subscription.suggestedCacheTTL || 3600;
      await redis.setex(cacheKey, ttl, JSON.stringify(allArticles));
      console.log(`[team-news] Cached ${allArticles.length} articles for team ${teamId} (TTL: ${ttl}s)`);
    } catch (cacheErr) {
      console.warn(`[team-news] Cache write failed for ${cacheKey}:`, cacheErr.message);
    }

    // Update subscription stats
    try {
      subscription.articleCount = allArticles.length;
      subscription.lastArticleFetch = new Date();
      await subscription.save();
    } catch (updateErr) {
      console.warn(`[team-news] Failed to update subscription stats:`, updateErr.message);
    }

    return allArticles.slice(0, limit);
  } catch (error) {
    console.error(`[team-news] Error fetching articles for team ${teamId}:`, error);
    throw error;
  }
}

/**
 * Clear cache for a team
 * @param {number} teamId - Team ID
 */
async function clearTeamCache(teamId) {
  try {
    const redis = getRedisClient();
    const cacheKey = `team_articles_${teamId}`;
    await redis.del(cacheKey);
    console.log(`[team-news] Cache cleared for team ${teamId}`);
  } catch (error) {
    console.warn(`[team-news] Failed to clear cache for team ${teamId}:`, error.message);
  }
}

/**
 * Clear cache for all teams
 */
async function clearAllTeamCache() {
  try {
    const redis = getRedisClient();
    const keys = await redis.keys('team_articles_*');
    if (keys.length > 0) {
      await redis.del(keys);
      console.log(`[team-news] Cache cleared for ${keys.length} teams`);
    }
  } catch (error) {
    console.warn(`[team-news] Failed to clear all caches:`, error.message);
  }
}

/**
 * Warm up cache for popular teams (background task)
 * @param {number} topCount - Number of top teams to cache
 */
async function warmupPopularTeams(topCount = 100) {
  try {
    console.log(`[team-news] Starting cache warmup for top ${topCount} teams`);

    const teams = await TeamRssFeedSubscription.find({ enabled: true })
      .sort({ articleCount: -1 })
      .limit(topCount)
      .select('teamId');

    let successCount = 0;
    let errorCount = 0;

    for (const team of teams) {
      try {
        await getTeamArticles(team.teamId, 50, false); // Skip cache, fetch fresh
        successCount++;
      } catch (err) {
        console.error(`[team-news] Warmup failed for team ${team.teamId}:`, err.message);
        errorCount++;
      }
    }

    console.log(`[team-news] Cache warmup completed: ${successCount} success, ${errorCount} errors`);
  } catch (error) {
    console.error('[team-news] Warmup process failed:', error);
  }
}

module.exports = {
  getTeamArticles,
  clearTeamCache,
  clearAllTeamCache,
  warmupPopularTeams,
  getRedisClient
};
