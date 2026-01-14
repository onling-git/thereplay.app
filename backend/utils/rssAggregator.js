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
    const articles = normalizedItems.map((item, index) => {
      // Better URL extraction logic
      let articleUrl = '#';
      
      // Try different URL sources in order of preference
      const possibleUrls = [
        item.link,
        item.guid,
        item.url,
        item.source?.url,
        item.id
      ].filter(Boolean);
      
      // Enhanced debugging for BBC feeds
      if (feed.name && feed.name.toLowerCase().includes('bbc')) {
        // Log the FULL item structure for debugging - all keys available
        const allItemKeys = Object.keys(item);
        console.log(`[rss-debug] BBC item "${item.title}" has keys:`, allItemKeys);
        
        // Log specific content fields
        console.log(`[rss-debug] Content fields:`, {
          description: item.description ? `"${item.description.substring(0, 100)}..."` : 'MISSING',
          summary: item.summary ? `"${item.summary.substring(0, 100)}..."` : 'MISSING',
          'content:encoded': item['content:encoded'] ? `"${item['content:encoded'].substring(0, 100)}..."` : 'MISSING',
          'content_encoded': item.content_encoded ? `"${item.content_encoded.substring(0, 100)}..."` : 'MISSING'
        });
        
        // Log the full item structure for debugging
        console.log(`[rss-debug] BBC item "${item.title}":`, {
          link: item.link,
          guid: item.guid,
          url: item.url,
          id: item.id,
          source: item.source,
          possibleUrls: possibleUrls
        });
        
        // Find the best URL using validation
        let bestUrl = null;
        for (const url of possibleUrls) {
          const validatedUrl = cleanAndValidateUrl(url);
          if (validatedUrl) {
            bestUrl = validatedUrl;
            break;
          }
        }
        
        if (bestUrl) {
          articleUrl = bestUrl;
          console.log(`[rss-debug] Selected validated URL: ${bestUrl}`);
        } else {
          // No valid URL found, skip this article
          console.warn(`[rss-warning] No valid article URL found for "${item.title}", skipping`);
          console.warn(`[rss-warning] Available URLs were:`, possibleUrls);
          return null; // This will filter out the article
        }
      } else {
        // For non-BBC feeds, use first available URL with validation
        let bestUrl = null;
        for (const url of possibleUrls) {
          const validatedUrl = cleanAndValidateUrl(url);
          if (validatedUrl) {
            bestUrl = validatedUrl;
            break;
          }
        }
        articleUrl = bestUrl || possibleUrls[0] || '#';
      }
      
      return {
        id: `${feed.id}-${index}-${Date.now()}`,
        title: item.title || 'No title',
        summary: item.description || 
                 item.summary || 
                 item['content:encoded'] || 
                 item.content_encoded ||
                 'No description available',
        source: feed.name,
        published_at: item.pubDate ? new Date(item.pubDate) : new Date(),
        url: articleUrl,
        image_url: item.enclosure?.$ ? item.enclosure.$.url : null,
        feed_id: feed.id,
        feed_priority: feed.priority,
        raw_categories: item.category || [],
        // Keep raw RSS item for debugging
        _debug_urls: possibleUrls,
        _debug_raw_item: process.env.NODE_ENV !== 'production' ? item : undefined
      };
    }).filter(article => article !== null); // Filter out null results from invalid URLs
    
    console.log(`[rss-aggregator] Fetched ${articles.length} articles from ${feed.name}`);
    
    // Debug: Log first few articles from each feed - including summary content
    if (articles.length > 0) {
      console.log(`[rss-debug] First article from ${feed.name}: "${articles[0].title}"`);
      console.log(`[rss-debug]   Summary length: ${articles[0].summary.length} chars`);
      console.log(`[rss-debug]   Summary preview: "${articles[0].summary.substring(0, 150)}..."`);
      console.log(`[rss-debug]   URL: ${articles[0].url}`);
    } else {
      console.log(`[rss-debug] No articles returned from ${feed.name}`);
    }
    
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
  
  // Exclude international content that isn't club-specific
  const internationalExclusions = [
    'world cup', 'world cup qualifiers', 'international', 'national team',
    'scotland national', 'england national', 'spain national', 'germany national',
    'france national', 'italy national', 'uefa nations league', 'euro 2024',
    'european championship', 'fifa ranking', 'international break',
    'international friendly', 'international match', 'national squad',
    'england squad', 'england team', 'england manager', 'england vs',
    'spain squad', 'germany squad', 'france squad', 'italy squad',
    'thomas tuchel', 'gareth southgate', // England managers
    
    // Other country football that could interfere with English league filtering
    'scottish premiership', 'scottish championship', 'scottish league', 'spfl',
    'welsh premier', 'cymru premier', 'league of wales',
    'irish league', 'league of ireland', 'airtricity league'
  ];
  
  // If it contains international exclusion terms, don't match league filters
  const hasInternationalContent = internationalExclusions.some(exclusion => 
    searchText.includes(exclusion)
  );
  
  if (hasInternationalContent) {
    return false;
  }
  
  // Check for league-specific keywords
  const hasLeagueKeyword = keywords.some(keyword => 
    searchText.includes(keyword.toLowerCase())
  );
  
  // For better filtering, also check for club-specific indicators
  if (hasLeagueKeyword) {
    // Additional validation for English Premier League (ID: 8)
    if (leagueId === 8) {
      // Exclude other Premier Leagues (Russian, Ukrainian, etc.)
      const otherPremierLeagueExclusions = [
        'russian premier', 'ukrainian premier', 'scottish premiership',
        'russian football', 'ukraine football', 'scotland football'
      ];
      
      const hasOtherPremierLeague = otherPremierLeagueExclusions.some(exclusion => 
        searchText.includes(exclusion)
      );
      
      if (hasOtherPremierLeague) {
        console.log(`[rss-filter] Excluding non-English Premier League content: "${article.title}"`);
        return false;
      }
      
      const premierLeagueClubs = [
        'arsenal', 'chelsea', 'liverpool', 'manchester city', 'manchester united',
        'tottenham', 'newcastle', 'aston villa', 'west ham', 'brighton',
        'crystal palace', 'fulham', 'brentford', 'wolves', 'nottingham forest',
        'everton', 'bournemouth', 'luton', 'burnley', 'sheffield united'
      ];
      
      const hasClubMention = premierLeagueClubs.some(club => 
        searchText.includes(club)
      );
      
      // For English Premier League, be specific
      return hasClubMention || 
             (searchText.includes('premier league') && !hasInternationalContent) ||
             searchText.includes('english premier league') ||
             searchText.includes('epl');
    }
    
    // For other Premier Leagues (Russian: 486, Ukrainian: 609)
    if (leagueId === 486 || leagueId === 609) {
      // These should have their own specific filtering if needed
      return hasLeagueKeyword;
    }
    
    // Additional validation for Championship to ensure it's about clubs
    if (leagueId === 9) {
      // Scottish football exclusions - these indicate it's NOT English Championship
      const scottishExclusions = [
        'scotland', 'scottish', 'premiership', 'st johnstone', 'st mirren', 'hearts', 'hibs',
        'rangers', 'celtic', 'aberdeen', 'dundee', 'kilmarnock', 'motherwell',
        'ross county', 'livingston', 'stjohnstone', 'hibernian', 'partick thistle',
        'in scotland', 'scottish championship', 'scottish league', 'spfl'
      ];
      
      // If it mentions Scottish football, exclude it
      const hasScottishContent = scottishExclusions.some(exclusion => 
        searchText.includes(exclusion)
      );
      
      if (hasScottishContent) {
        console.log(`[rss-filter] Excluding Scottish content from English Championship: "${article.title}"`);
        return false;
      }
      
      const championshipClubs = [
        'leicester', 'leeds', 'burnley', 'sheffield united', 'luton', 'norwich',
        'west brom', 'middlesbrough', 'coventry', 'hull', 'stoke', 'bristol city',
        'preston', 'millwall', 'blackburn', 'cardiff', 'swansea', 'queens park rangers',
        'watford', 'birmingham', 'rotherham', 'plymouth', 'ipswich', 'southampton',
        'wrexham', 'stockport', 'wycombe', 'exeter', 'peterborough', 'bolton'
      ];
      
      const hasClubMention = championshipClubs.some(club => 
        searchText.includes(club)
      );
      
      // For Championship, be more strict - require either:
      // 1. Explicit English Championship club mention, OR
      // 2. "english championship" or "efl championship" specifically
      return hasClubMention || 
             searchText.includes('english championship') || 
             searchText.includes('efl championship');
    }
    
    return true;
  }
  
  return false;
}

/**
 * Generate keywords automatically from a team name
 * This makes the system scalable for any team without hardcoding
 */
function generateTeamKeywords(teamName) {
  if (!teamName) return [];
  
  const name = teamName.toLowerCase();
  const keywords = [name]; // Always include the full name
  
  // Add variations by removing common suffixes
  const suffixes = ['fc', 'football club', 'city', 'united', 'athletic', 'albion', 'rovers', 'wanderers', 'town'];
  let baseName = name;
  
  for (const suffix of suffixes) {
    if (baseName.endsWith(` ${suffix}`)) {
      baseName = baseName.replace(` ${suffix}`, '').trim();
      keywords.push(baseName);
      break;
    }
  }
  
  // Add common abbreviations for well-known patterns
  if (name.includes('manchester')) {
    if (name.includes('city')) keywords.push('man city');
    if (name.includes('united')) keywords.push('man united', 'man utd');
  }
  
  // Add single word if it's unique enough (longer than 3 chars and not common words)
  const words = baseName.split(' ').filter(word => 
    word.length > 3 && 
    !['city', 'united', 'town', 'rovers', 'athletic', 'albion', 'wanderers'].includes(word)
  );
  keywords.push(...words);
  
  return [...new Set(keywords)]; // Remove duplicates
}

/**
 * Check if article matches team keywords
 */
function matchesTeam(article, teamId, teamSlug = null) {
  if (!teamId && !teamSlug) return true; // No filter = include all
  
  const searchText = (article.title + ' ' + article.summary).toLowerCase();
  
  // First try exact teamSlug match from hardcoded keywords (backwards compatibility)
  if (teamSlug) {
    const { teamKeywords } = require('../config/rssFeeds');
    const exactKeywords = teamKeywords[teamSlug];
    if (exactKeywords && exactKeywords.length > 0) {
      const exactMatches = exactKeywords.some(keyword => 
        searchText.includes(keyword.toLowerCase())
      );
      
      if (exactMatches) {
        console.log(`[rss-team-filter] Article "${article.title}" matches team ${teamSlug} via hardcoded keywords`);
        return true;
      }
    }
  }
  
  // Generate keywords automatically from the teamId (treating it as team name)
  // Try both teamId and teamSlug
  const autoKeywordsFromId = generateTeamKeywords(teamId);
  const autoKeywordsFromSlug = teamSlug ? generateTeamKeywords(teamSlug) : [];
  
  // Combine all keywords and remove duplicates
  const allAutoKeywords = [...new Set([...autoKeywordsFromId, ...autoKeywordsFromSlug])];
  
  if (allAutoKeywords.length > 0) {
    const autoMatches = allAutoKeywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
    
    if (autoMatches) {
      console.log(`[rss-team-filter] Article "${article.title}" matches team ${teamId} via auto-generated keywords: [${allAutoKeywords.join(', ')}]`);
      return true;
    }
  }
  
  console.log(`[rss-team-filter] Article "${article.title}" doesn't match team ${teamId || teamSlug} (checked keywords: [${allAutoKeywords.join(', ')}])`);
  return false;
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
    'atletico', 'sevilla', 'dortmund', 'ajax', 'porto', 'benfica',
    // Soccer leagues worldwide
    'mls', 'nwsl', 'usl', 'concacaf', 'copa america', 'conmebol',
    'women\'s soccer', 'women soccer', 'us soccer',
    // Common cup/tournament names
    'fa cup', 'cup', 'league cup', 'carabao', 'efl cup'
  ];
  
  // Non-football sports keywords that should exclude the article
  const nonFootballKeywords = [
    // Traditional sports
    'basketball', 'nba', 'wnba', 'baseball', 'mlb', 'american football', 'nfl', 
    'hockey', 'nhl', 'tennis', 'golf', 'pga', 'lpga', 'formula 1', 'f1', 'boxing',
    'cricket', 'rugby', 'olympics', 'swimming', 'athletics', 'cycling', 'track and field',
    'super bowl', 'world series', 'stanley cup', 'wimbledon', 'masters tournament',
    'grand slam', 'grand prix', 'commonwealth games',
    
    // Motor sports
    'nascar', 'motogp', 'formula e', 'rally', 'indycar', 'le mans',
    
    // Other sports
    'volleyball', 'badminton', 'table tennis', 'ping pong', 'squash', 'snooker',
    'darts', 'wrestling', 'ufc', 'mma', 'martial arts', 'judo', 'karate',
    'skiing', 'snowboarding', 'ice skating', 'figure skating', 'speed skating',
    'surfing', 'sailing', 'rowing', 'canoeing', 'kayaking', 'triathlon',
    'marathon', 'half marathon', '10k', '5k', 'cross country', 'decathlon',
    'gymnastics', 'weightlifting', 'powerlifting', 'bodybuilding', 'crossfit',
    
    // American college/high school football (not soccer)
    'college football', 'high school football', 'cfp', 'ncaa football',
    
    // Winter/Summer Olympics specific
    'winter olympics', 'summer olympics', 'paralympics', 'olympic games',
    
    // Esports (if not football games)
    'esports', 'e-sports', 'gaming', 'video games', 'league of legends', 'dota',
    'counter-strike', 'valorant',
    
    // Horse racing and other
    'horse racing', 'derby', 'kentucky derby', 'ascot', 'grand national',
    'polo', 'equestrian'
  ];
  
  // If it contains non-football keywords, exclude it
  const hasNonFootballContent = nonFootballKeywords.some(keyword => 
    searchText.includes(keyword)
  );
  
  if (hasNonFootballContent) {
    console.log(`[rss-filter] Excluding non-football article: "${article.title}" (contains: ${nonFootballKeywords.find(k => searchText.includes(k))})`);
    return false;
  }
  
  // If it contains football keywords, include it
  const hasFootballContent = footballKeywords.some(keyword => 
    searchText.includes(keyword)
  );
  
  // For feeds that are specifically football-focused, be more lenient
  if (article.source && (
    article.source.toLowerCase().includes('football') ||
    article.source.toLowerCase().includes('soccer') ||
    article.source.toLowerCase().includes('bbc sport') ||
    article.source.toLowerCase().includes('espn') ||
    article.source.toLowerCase().includes('sky sports') ||
    article.source.toLowerCase().includes('goal') ||
    article.source.toLowerCase().includes('marca')
  )) {
    console.log(`[rss-filter] Auto-approving article from trusted football source: "${article.title}" (${article.source})`);
    return true; // Trust football-specific sources
  }
  
  if (hasFootballContent) {
    console.log(`[rss-filter] Article approved by keywords: "${article.title}" (${article.source})`);
    return true;
  }
  
  console.log(`[rss-filter] Article rejected - no football keywords: "${article.title}" (${article.source})`);
  return false;
}

/**
 * Check if URL looks like a category/overview page rather than a specific article
 */
function isCategoryPageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  
  const categoryPatterns = [
    '/championship$',
    '/football$', 
    '/sport$',
    '/soccer$',
    '/premier-league$',
    '/la-liga$',
    '/bundesliga$',
    '/serie-a$',
    '/ligue-1$',
    '/football/championship$',
    '/sport/football$',
    '/soccer/premier-league$',
    '/football/results$',
    '/football/fixtures$',
    '/football/tables$',
    '/football/gossip$',
    '/soccer/fixtures$',
    '/soccer/results$',
    '/soccer/tables$',
    '/news/football$',
    '/news/soccer$'
  ];
  
  return categoryPatterns.some(pattern => new RegExp(pattern).test(url));
}

/**
 * Validate if a URL looks like a legitimate article URL
 */
function isValidArticleUrl(url) {
  if (!url || typeof url !== 'string' || url === '#') return false;
  
  // Must be a valid HTTP/HTTPS URL
  if (!url.match(/^https?:\/\/.+/)) return false;
  
  // For BBC specifically, accept both article and video URLs to ensure small teams get coverage
  // This is more permissive than before because small teams may only appear in video content
  if (url.includes('bbc.co') || url.includes('bbc.com')) {
    // Accept /articles/, /videos/, /news/, etc. - just not homepage or section pages
    const hasContent = url.match(/\/(articles|videos|news|sport)\/[a-zA-Z0-9_\-]+/);
    if (!hasContent) {
      return false;
    }
    return true;
  }
  
  // For other domains, do basic validation
  return !isCategoryPageUrl(url);
}

/**
 * Clean and validate a URL, returning null if invalid
 */
function cleanAndValidateUrl(url) {
  if (!url || typeof url !== 'string') return null;
  
  // Remove query parameters that might cause issues
  let cleanUrl = url.split('?')[0].split('#')[0];
  
  // Validate the cleaned URL
  if (!isValidArticleUrl(cleanUrl)) {
    return null;
  }
  
  return cleanUrl;
}

/**
 * Additional context-aware filtering for non-football content
 */
function isDefinitelyNotFootball(article) {
  const searchText = (article.title + ' ' + article.summary).toLowerCase();
  
  // Strong indicators this is definitely not football/soccer - be very specific to avoid false positives
  const definitelyNotFootballPatterns = [
    // Basketball specific
    'three-pointer', 'slam dunk', 'free throw', 'rebound', 'assist',
    'points per game' && ('nba' || 'basketball'),
    
    // American Football specific  
    'touchdown', 'field goal', 'quarterback', 'super bowl', 'nfl draft',
    'first down', 'interception', 'fumble',
    
    // Baseball specific
    'home run', 'strikeout', 'world series', 'mlb draft', 'innings pitched',
    'batting average', 'rbi', 'stolen base',
    
    // Tennis specific
    'ace serve', 'break point', 'match point', 'set score', 'grand slam tennis',
    'us open tennis', 'french open tennis', 'australian open tennis', 'wimbledon tennis',
    
    // Golf specific
    'par', 'birdie', 'eagle', 'bogey', 'tee time', 'fairway', 'masters tournament',
    'pga tour', 'lpga',
    
    // Combat sports specific
    'knockout', 'tko', 'heavyweight bout', 'welterweight', 'bantamweight',
    'title fight', 'rounds',
    
    // Cricket specific  
    'wicket', 'innings', 'bowl', 'bat', 'stumps', 'over', 'test match',
    'ashes series',
    
    // Hockey specific
    'puck', 'goalie mask', 'power play', 'stanley cup final',
    
    // Rugby specific
    'try', 'scrum', 'lineout', 'conversion', 'rugby league', 'rugby union',
    
    // Motor racing specific
    'formula 1', 'grand prix', 'pole position', 'pit stop', 'fastest lap',
    'nascar', 'indycar'
  ];
  
  // Only exclude if we find very specific non-football terms
  const hasDefinitelyNotFootball = definitelyNotFootballPatterns.some(pattern => {
    if (typeof pattern === 'string') {
      return searchText.includes(pattern);
    }
    return false;
  });
  
  return hasDefinitelyNotFootball;
}

/**
 * Check if article matches any filter criteria
 */
function matchesFilters(article, filters = {}) {
  const { leagueId, teamId, teamSlug, keyword } = filters;
  
  // Strong exclusion check first - but disable it for now as it's too aggressive
  // if (isDefinitelyNotFootball(article)) {
  //   console.log(`[rss-filter] Definitely not football: "${article.title}"`);
  //   return false;
  // }
  
  // IMPORTANT: Check if article mentions the specific team FIRST
  // If it explicitly mentions the team we're searching for, include it regardless of other filters
  const hasTeamFilter = Boolean(teamId || teamSlug);
  if (hasTeamFilter) {
    const searchText = (article.title + ' ' + article.summary).toLowerCase();
    const keywords = [];
    if (teamId) keywords.push(teamId.toLowerCase());
    if (teamSlug) keywords.push(teamSlug.toLowerCase());
    
    const mentionsTeam = keywords.some(keyword => searchText.includes(keyword));
    if (mentionsTeam) {
      console.log(`[rss-filter] Article mentions team explicitly: "${article.title}"`);
      // Still check for non-football content, but skip the generic football keyword check
      if (isDefinitelyNotFootball(article)) {
        console.log(`[rss-filter] Excluding due to definitely non-football content: "${article.title}"`);
        return false;
      }
      // Article mentions the team - include it even if it lacks generic football keywords
      return true;
    }
  }
  
  // Identify trusted football-specific feeds that don't need keyword filtering
  const trustedFootballFeeds = [
    'bbc sport football',
    'bbc sport all',
    'bbc premier league',
    'bbc championship',
    'sky sports football',
    'espn soccer',
    'football italia',
    'marca english',
    'lequipe football',
    'goal.com'
  ];
  
  const isFromTrustedFootballFeed = article.source && 
    trustedFootballFeeds.some(feed => 
      article.source.toLowerCase().includes(feed.toLowerCase())
    );
  
  // For trusted football feeds, skip the general football keyword check
  // since content from these feeds is inherently football-related
  if (!isFromTrustedFootballFeed) {
    // Then check if it's football-related (to filter out other sports)
    if (!isFootballRelated(article)) {
      return false;
    }
  } else {
    console.log(`[rss-filter] Skipping football filter for article from trusted feed: "${article.title}" (${article.source})`);
  }
  
  // League filter
  if (leagueId && !matchesLeague(article, leagueId)) {
    return false;
  }
  
  // Team filter - pass both teamId and teamSlug
  if (teamId && !matchesTeam(article, teamId, teamSlug)) {
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
  const { leagueId = null, teamId = null, teamSlug = null, keyword = null, limit = 20, useCache = true } = options;
  
  // For team-filtered queries, fetch a larger pool before filtering to ensure small teams get results
  // Without this, teams with fewer mentions in articles would get 0-5 results due to filtering
  // Small teams like Reading/Southampton may only appear in a fraction of generic football articles
  const hasTeamFilter = Boolean(teamId || teamSlug);
  const fetchPoolMultiplier = hasTeamFilter ? 50 : 2; // Fetch 50x more articles when filtering by team (was 10x)
  const fetchLimit = Math.min(limit * fetchPoolMultiplier, 1000); // Cap at 1000 to avoid memory issues (was 500)
  
  const cacheKey = `aggregated-${leagueId || 'all'}-${teamId || 'all'}-${teamSlug || 'all'}-${keyword || 'all'}-${limit}`;
  
  // Check cache first
  if (useCache && cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`[rss-aggregator] Returning cached results for ${cacheKey}`);
      return cached.data;
    }
    cache.delete(cacheKey);
  }
  
  let enabledFeeds;
  
  try {
    // Try to get feeds from database first
    enabledFeeds = await RssFeed.getEnabledFeeds();
    console.log(`[rss-aggregator] Loaded ${enabledFeeds.length} feeds from database`);
    enabledFeeds.forEach(feed => {
      console.log(`[rss-debug] Database feed: ${feed.name} (enabled: ${feed.enabled}, priority: ${feed.priority})`);
    });
  } catch (dbError) {
    console.warn(`[rss-aggregator] Database not available (${dbError.message}), using config fallback`);
    
    // Fallback to config file when database is unavailable
    const { rssFeeds } = require('../config/rssFeeds');
    enabledFeeds = rssFeeds
      .filter(feed => feed.enabled)
      .map(feed => ({
        ...feed,
        // Add the updateFetchStats method for compatibility
        updateFetchStats: async function(success, articleCount, error) {
          // Mock implementation - could log to file or just return
          console.log(`[rss-feed-${this.id}] Fetch stats: ${success ? 'success' : 'error'}, articles: ${articleCount}${error ? `, error: ${error}` : ''}`);
          return Promise.resolve();
        }
      }));
    
    console.log(`[rss-aggregator] Using ${enabledFeeds.length} feeds from config file`);
  }
  console.log(`[rss-aggregator] Aggregating from ${enabledFeeds.length} enabled feeds (fetch pool: ${fetchLimit} articles)`);
  
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
  
  console.log(`[rss-aggregator] Collected ${allArticles.length} total articles from all feeds`);
  
  // Filter out category page URLs UNLESS they mention a specific team
  // (teams may have limited coverage, so we include video coverage if it mentions the team)
  const beforeUrlFilter = allArticles.length;
  allArticles = allArticles.filter(article => {
    if (isCategoryPageUrl(article.url)) {
      // If searching for a specific team, keep the article even if it's a category URL
      // This allows video coverage or other content format to be included for small teams
      if (teamId || teamSlug) {
        const searchText = (article.title + ' ' + article.summary).toLowerCase();
        const keywords = [];
        if (teamId) keywords.push(teamId.toLowerCase());
        if (teamSlug) keywords.push(teamSlug.toLowerCase());
        
        const mentionsTeam = keywords.some(keyword => searchText.includes(keyword));
        if (mentionsTeam) {
          return true; // Keep it - it's about the specific team
        }
      }
      
      console.log(`[rss-url-filter] Excluding category page: "${article.title}" -> ${article.url}`);
      return false;
    }
    return true;
  });
  
  if (beforeUrlFilter !== allArticles.length) {
    console.log(`[rss-aggregator] Filtered out ${beforeUrlFilter - allArticles.length} category page URLs`);
  }
  
  // First, try to filter by team if provided
  let filteredArticles = allArticles;
  const isTeamSearch = Boolean(teamId || teamSlug);
  
  if (isTeamSearch) {
    // Try team-specific filter
    const filters = { leagueId, teamId, teamSlug, keyword };
    filteredArticles = allArticles.filter(article => matchesFilters(article, filters));
    console.log(`[rss-aggregator] Team-specific filter returned ${filteredArticles.length} articles for team ${teamId || teamSlug}`);
  } else if (leagueId || keyword) {
    // For non-team searches, apply regular filters
    const filters = { leagueId, keyword };
    filteredArticles = allArticles.filter(article => matchesFilters(article, filters));
    const filterDesc = [
      leagueId && `league ${leagueId}`,
      keyword && `keyword "${keyword}"`
    ].filter(Boolean).join(', ');
    console.log(`[rss-aggregator] Filtered to ${filteredArticles.length} articles for ${filterDesc}`);
  }
  
  // Sort by priority (lower number = higher priority) then by date
  const sortedArticles = filteredArticles
    .sort((a, b) => {
      // First by feed priority
      if (a.feed_priority !== b.feed_priority) {
        return a.feed_priority - b.feed_priority;
      }
      // Then by publish date (newest first)
      return new Date(b.published_at) - new Date(a.published_at);
    })
    .slice(0, limit);
  
  // Cache the results - but DON'T cache empty results for team-specific searches
  // Empty results mean we should keep trying instead of serving stale empty cache
  const shouldCache = useCache && !(isTeamSearch && sortedArticles.length === 0);
  
  if (shouldCache) {
    console.log(`[rss-aggregator] Caching ${sortedArticles.length} results for ${cacheKey}`);
    cache.set(cacheKey, {
      data: sortedArticles,
      timestamp: Date.now()
    });
  } else if (isTeamSearch && sortedArticles.length === 0) {
    console.log(`[rss-aggregator] NOT caching empty result for team search (${cacheKey}) - will retry on next request`);
  }
  
  console.log(`[rss-aggregator] Returning ${sortedArticles.length}/${limit} aggregated articles (${hasTeamFilter ? '50x pool' : '2x pool'} search)`);
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
  isFootballRelated,
  isDefinitelyNotFootball,
  isCategoryPageUrl,
  isValidArticleUrl,
  cleanAndValidateUrl,
  generateTeamKeywords
};