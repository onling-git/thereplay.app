const axios = require('axios');
const xml2js = require('xml2js');
const RssFeed = require('../models/RssFeed');
const { leagueKeywords, getKeywordsForLeague, getKeywordsForTeam } = require('../config/rssFeeds');

// Simple in-memory cache
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Fetch and parse a single RSS feed
 */
async function fetchRssFeed(feed) {
  try {
    console.log(`[rss-aggregator] Fetching ${feed.name} from ${feed.url}`);
    
    const response = await axios.get(feed.url, {
      timeout: feed.fetchTimeout || 10000,
      headers: {
        'User-Agent': feed.userAgent || 'Mozilla/5.0 (compatible; FootballNewsAggregator/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });
    
    const parser = new xml2js.Parser({
      explicitArray: false,
      ignoreAttrs: false,
      trim: true
    });
    
    const result = await parser.parseStringPromise(response.data);
    const items = result?.rss?.channel?.item || [];
    
    // Normalize items to array if single item
    const normalizedItems = Array.isArray(items) ? items : [items];
    
    // Transform to our format
    const articles = normalizedItems.map((item, index) => ({
      id: `${feed.id}-${index}-${Date.now()}`,
      title: item.title || 'No title',
      summary: item.description || item.summary || 'No description available',
      source: feed.name,
      published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
      url: item.link || item.guid || '#',
      image_url: item.enclosure?.$ ? item.enclosure.$.url : null,
      feed_id: feed.id,
      feed_priority: feed.priority,
      raw_categories: item.category || []
    }));
    
    console.log(`[rss-aggregator] Fetched ${articles.length} articles from ${feed.name}`);
    
    // Update feed stats in database if it's a database model
    if (feed.updateFetchStats) {
      await feed.updateFetchStats(true, articles.length);
    }
    
    return articles;
    
  } catch (error) {
    console.error(`[rss-aggregator] Error fetching ${feed.name}:`, error.message);
    
    // Update feed stats in database if it's a database model
    if (feed.updateFetchStats) {
      await feed.updateFetchStats(false, 0, error.message);
    }
    
    return [];
  }
}

/**
 * Check if article matches league keywords
 */
function matchesLeague(article, leagueId) {
  if (!leagueId) return true; // No filter = include all
  
  const keywords = getKeywordsForLeague(leagueId);
  if (!keywords || keywords.length === 0) return true;
  
  const searchText = (article.title + ' ' + article.summary).toLowerCase();
  
  return keywords.some(keyword => 
    searchText.includes(keyword.toLowerCase())
  );
}

/**
 * Check if article matches team keywords
 */
function matchesTeam(article, teamId) {
  if (!teamId) return true; // No filter = include all
  
  const keywords = getKeywordsForTeam(teamId);
  if (!keywords || keywords.length === 0) return true;
  
  const searchText = (article.title + ' ' + article.summary).toLowerCase();
  
  return keywords.some(keyword => 
    searchText.includes(keyword.toLowerCase())
  );
}

/**
 * Check if article is football/soccer related (to filter out other sports)
 */
function isFootballRelated(article) {
  const searchText = (article.title + ' ' + article.summary).toLowerCase();
  
  // Football/soccer keywords that should be present
  const footballKeywords = [
    'football', 'soccer', 'fc', 'premier league', 'championship', 'la liga', 'laliga',
    'bundesliga', 'serie a', 'ligue 1', 'champions league', 'europa league', 'uefa',
    'fifa', 'world cup', 'euro 2024', 'euros', 'transfer', 'goal', 'striker',
    'midfielder', 'defender', 'goalkeeper', 'penalty', 'offside', 'tackle',
    'arsenal', 'chelsea', 'liverpool', 'manchester', 'tottenham', 'barcelona',
    'real madrid', 'bayern', 'juventus', 'psg', 'milan', 'inter', 'napoli',
    'atletico', 'sevilla', 'dortmund', 'ajax', 'porto', 'benfica'
  ];
  
  // Non-football sports keywords that should exclude the article
  const nonFootballKeywords = [
    'basketball', 'nba', 'baseball', 'mlb', 'american football', 'nfl',
    'hockey', 'nhl', 'tennis', 'golf', 'formula 1', 'f1', 'boxing',
    'cricket', 'rugby', 'olympics', 'swimming', 'athletics', 'cycling',
    'super bowl', 'world series', 'stanley cup', 'wimbledon'
  ];
  
  // If it contains non-football keywords, exclude it
  const hasNonFootballContent = nonFootballKeywords.some(keyword => 
    searchText.includes(keyword)
  );
  
  if (hasNonFootballContent) {
    return false;
  }
  
  // If it contains football keywords, include it
  const hasFootballContent = footballKeywords.some(keyword => 
    searchText.includes(keyword)
  );
  
  // For feeds that are specifically football-focused (like BBC Football), be more lenient
  if (article.source && (
    article.source.toLowerCase().includes('football') ||
    article.source.toLowerCase().includes('soccer')
  )) {
    return true; // Trust football-specific sources
  }
  
  return hasFootballContent;
}

/**
 * Check if article matches any filter criteria
 */
function matchesFilters(article, filters = {}) {
  const { leagueId, teamId, keyword } = filters;
  
  // First check if it's football-related (to filter out other sports)
  if (!isFootballRelated(article)) {
    return false;
  }
  
  // League filter
  if (leagueId && !matchesLeague(article, leagueId)) {
    return false;
  }
  
  // Team filter
  if (teamId && !matchesTeam(article, teamId)) {
    return false;
  }
  
  // Keyword filter (general search)
  if (keyword) {
    const searchText = (article.title + ' ' + article.summary).toLowerCase();
    const keywordLower = keyword.toLowerCase();
    if (!searchText.includes(keywordLower)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Aggregate articles from all enabled RSS feeds
 */
async function aggregateFeeds(options = {}) {
  const { leagueId = null, teamId = null, keyword = null, limit = 20, useCache = true } = options;
  
  const cacheKey = `aggregated-${leagueId || 'all'}-${teamId || 'all'}-${keyword || 'all'}-${limit}`;
  
  // Check cache first
  if (useCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[rss-aggregator] Returning cached results for ${cacheKey}`);
      return cached.data;
    }
    cache.delete(cacheKey);
  }
  
  const enabledFeeds = await RssFeed.getEnabledFeeds();
  console.log(`[rss-aggregator] Aggregating from ${enabledFeeds.length} enabled feeds`);
  
  // Fetch all feeds in parallel
  const feedPromises = enabledFeeds.map(feed => fetchRssFeed(feed));
  const feedResults = await Promise.allSettled(feedPromises);
  
  // Collect all articles
  let allArticles = [];
  feedResults.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      allArticles = allArticles.concat(result.value);
    } else {
      console.error(`[rss-aggregator] Feed ${enabledFeeds[index].name} failed:`, result.reason?.message);
    }
  });
  
  // Apply filters
  const filters = { leagueId, teamId, keyword };
  if (leagueId || teamId || keyword) {
    allArticles = allArticles.filter(article => matchesFilters(article, filters));
    const filterDesc = [
      leagueId && `league ${leagueId}`,
      teamId && `team ${teamId}`,
      keyword && `keyword "${keyword}"`
    ].filter(Boolean).join(', ');
    console.log(`[rss-aggregator] Filtered to ${allArticles.length} articles for ${filterDesc}`);
  }
  
  // Sort by priority (lower number = higher priority) then by date
  const sortedArticles = allArticles
    .sort((a, b) => {
      // First by feed priority
      if (a.feed_priority !== b.feed_priority) {
        return a.feed_priority - b.feed_priority;
      }
      // Then by publish date (newest first)
      return new Date(b.published_at) - new Date(a.published_at);
    })
    .slice(0, limit);
  
  // Cache the results
  if (useCache) {
    cache.set(cacheKey, {
      data: sortedArticles,
      timestamp: Date.now()
    });
  }
  
  console.log(`[rss-aggregator] Returning ${sortedArticles.length} aggregated articles`);
  return sortedArticles;
}

/**
 * Clear all cached feeds (useful for admin/refresh)
 */
function clearCache() {
  cache.clear();
  console.log('[rss-aggregator] Cache cleared');
}

/**
 * Get cache statistics
 */
function getCacheStats() {
  return {
    entries: cache.size,
    keys: Array.from(cache.keys()),
    ttlMinutes: CACHE_TTL / (1000 * 60)
  };
}

module.exports = {
  aggregateFeeds,
  fetchRssFeed,
  clearCache,
  getCacheStats,
  matchesLeague,
  matchesTeam,
  matchesFilters,
  isFootballRelated
};