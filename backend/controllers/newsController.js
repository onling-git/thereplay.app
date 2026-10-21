const Match = require('../models/Match');
const Report = require('../models/Report');
const { get: smGet } = require('../utils/sportmonks');
const { aggregateFeeds: aggregateAllFeeds } = require('../utils/rssAggregator');
const policy = require('../services/coveragePolicy');
async function aggregateFeeds(options = {}) {
  const publicCoverage = await policy.getCoverage();
  if (options.leagueId) await policy.assertPublicCompetition(options.leagueId);
  if (options.teamId || options.teamSlug) {
    const requested = options.teamSlug || options.teamId;
    const team = publicCoverage.teams.find(team =>
      [team.id, team.slug, team.name].some(value => String(value).toLowerCase() === String(requested).toLowerCase()));
    if (!team) throw Object.assign(new Error('Team not found'), { statusCode: 404 });
    options = { ...options, teamId: team.name, teamSlug: team.slug };
  }
  return aggregateAllFeeds({ ...options, publicCoverage });
}
const { publicReportStages } = require('../utils/publicReports');
const { recordNewsSnapshot } = require('../utils/newsSitemapSnapshot');

// Helper to add timeout to promises
function withTimeout(promise, ms, timeoutError = 'Request timeout') {
  return Promise.race([
    promise,
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(timeoutError)), ms)
    )
  ]);
}

/**
 * GET /api/news
 * Returns latest news articles from SportMonks API
 */
exports.getNews = async (req, res) => {
  let news = [];
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    
    
    try {
      // Use RSS aggregator for real news from external feeds with 3s timeout
      const articles = await withTimeout(aggregateFeeds({ limit }), 3000, 'RSS aggregator timeout');
      
      if (articles && articles.length > 0) {
        // Transform to match frontend format
        news = articles.map(article => ({
          id: article.id,
          title: article.title,
          summary: article.summary,
          source: article.source,
          published_at: article.published_at,
          source_published_at: article.source_published_at,
          league_id: null, // RSS aggregator doesn't map to specific league IDs yet
          league_name: null,
          image_url: article.image_url,
          url: article.url
        }));
        
      } else {
        
        // Try again with no league filtering to get general football news
        const generalArticles = await withTimeout(
          aggregateFeeds({ 
            limit,
            useCache: false // Don't use cache for retry
          }),
          3000,
          'RSS aggregator timeout (retry)'
        );
        
        if (generalArticles && generalArticles.length > 0) {
          news = generalArticles.map(article => ({
            id: article.id,
            title: article.title,
            summary: article.summary,
            source: article.source,
            published_at: article.published_at,
            source_published_at: article.source_published_at,
            league_id: null,
            league_name: null,
            image_url: article.image_url,
            url: article.url
          }));
          
        }
      }
    } catch (rssError) {
      console.error('[news] RSS aggregator error:', rssError.message);
    }
    
    await recordNewsSnapshot('/news', news, limit);
    return res.json(news);
  } catch (err) {
    console.error('getNews error:', err);
    res.status(500).json({ error: 'Failed to get news' });
  }
};

/**
 * GET /api/news (FALLBACK - if RSS aggregator fails)
 * Returns comprehensive mock news data
 */
exports.getNewsFallback = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    
    
    const mockNews = [
      // Premier League (8)
      {
        id: 1,
        title: "Premier League Transfer Window Updates",
        summary: "Latest transfer news and rumors from the Premier League as clubs prepare for the upcoming window.",
        source: "BBC Sport",
        published_at: new Date(Date.now() - 1000 * 60 * 30),
        league_id: 8,
        league_name: "Premier League",
        image_url: null,
        url: "https://www.bbc.com/sport/football/premier-league"
      },
      {
        id: 32,
        title: "Manchester City's Title Defense Strategy",
        summary: "Pep Guardiola discusses his tactical approach for retaining the Premier League title.",
        source: "Sky Sports",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 3),
        league_id: 8,
        league_name: "Premier League",
        image_url: null,
        url: "https://www.skysports.com/premier-league"
      },
      {
        id: 33,
        title: "Arsenal's Young Guns Impress Again",
        summary: "Mikel Arteta's faith in youth continues to pay dividends for the Gunners.",
        source: "BBC Sport",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 5),
        league_id: 8,
        league_name: "Premier League",
        image_url: null,
        url: "https://www.bbc.com/sport/football/premier-league"
      },
      
      // La Liga (564)
      {
        id: 3,
        title: "La Liga Title Race Heating Up",
        summary: "With just months left in the season, the race for the La Liga title is intensifying between the top clubs.",
        source: "ESPN",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 4),
        league_id: 564,
        league_name: "La Liga",
        image_url: null,
        url: "https://www.espn.com/soccer/league/_/name/esp.1"
      },
      {
        id: 24,
        title: "Atletico Madrid's Defensive Masterclass",
        summary: "Diego Simeone's tactical approach continues to frustrate opponents across La Liga.",
        source: "AS",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 7),
        league_id: 564,
        league_name: "La Liga",
        image_url: null,
        url: "https://as.com/futbol/primera/"
      },
      {
        id: 25,
        title: "Real Madrid vs Barcelona El Clasico Preview",
        summary: "A detailed look ahead to the upcoming El Clasico between Real Madrid and Barcelona.",
        source: "Marca",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 8),
        league_id: 564,
        league_name: "La Liga",
        image_url: null,
        url: "https://www.marca.com/en/football/spanish-football.html"
      },
      
      // Bundesliga (82)
      {
        id: 4,
        title: "Bundesliga Weekend Preview",
        summary: "A look ahead to this weekend's Bundesliga fixtures with key matchups and players to watch.",
        source: "Sky Sports",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 6),
        league_id: 82,
        league_name: "Bundesliga",
        image_url: null,
        url: "https://www.skysports.com/bundesliga"
      },
      {
        id: 20,
        title: "Borussia Dortmund's Champions League Hopes",
        summary: "Dortmund looks to secure their Champions League qualification spot with strong performances.",
        source: "ESPN",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 9),
        league_id: 82,
        league_name: "Bundesliga", 
        image_url: null,
        url: "https://www.espn.com/soccer/league/_/name/ger.1"
      },
      {
        id: 21,
        title: "Bayern Munich Transfer Plans Revealed",
        summary: "Bayern Munich's board discusses their strategy for strengthening the squad in the upcoming transfer window.",
        source: "ESPN",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 10),
        league_id: 82,
        league_name: "Bundesliga",
        image_url: null,
        url: "https://www.espn.com/soccer/league/_/name/ger.1"
      },
      
      // Championship (9)
      {
        id: 17,
        title: "Championship Promotion Race Intensifies",
        summary: "The battle for promotion to the Premier League is heating up with several teams in contention.",
        source: "BBC Sport",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 13),
        league_id: 9,
        league_name: "Championship",
        image_url: null,
        url: "https://www.bbc.co.uk/sport/football/articles/cn970x1n28ro"
      },
      {
        id: 28,
        title: "Leicester City's Championship Dominance",
        summary: "The Foxes continue their impressive form as they push for immediate Premier League return.",
        source: "BBC Sport",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 34),
        league_id: 9,
        league_name: "Championship",
        image_url: null,
        url: "https://www.bbc.co.uk/sport/football/articles/cm2em7z2eq2o"
      },
      {
        id: 29,
        title: "Championship's Young Stars Making Headlines",
        summary: "Emerging talent across the Championship is catching the attention of Premier League scouts.",
        source: "Sky Sports",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 13),
        league_id: 9,
        league_name: "Championship",
        image_url: null,
        url: "https://www.skysports.com/championship"
      },
      
      // Serie A (384)
      {
        id: 5,
        title: "Serie A Tactical Analysis",
        summary: "Breaking down the tactical trends and innovations in Serie A this season.",
        source: "Football Italia",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 14),
        league_id: 384,
        league_name: "Serie A",
        image_url: null,
        url: "https://www.football-italia.net/"
      },
      {
        id: 14,
        title: "AC Milan vs Inter Milan Derby Preview",
        summary: "The Milan derby is set to be one of the most exciting matches of the Serie A season.",
        source: "Gazzetta dello Sport",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 15),
        league_id: 384,
        league_name: "Serie A",
        image_url: null,
        url: "https://www.gazzetta.it/calcio/serie-a/"
      },
      
      // Ligue 1 (301)
      {
        id: 15,
        title: "PSG Dominance in Ligue 1 Continues",
        summary: "Paris Saint-Germain maintains their strong position at the top of Ligue 1 with consistent performances.",
        source: "L'Equipe",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 16),
        league_id: 301,
        league_name: "Ligue 1",
        image_url: null,
        url: "https://www.lequipe.fr/Football/Ligue-1/"
      },
      {
        id: 16,
        title: "Marseille's European Ambitions",
        summary: "Olympique Marseille sets their sights on qualifying for European competitions this season.",
        source: "RMC Sport",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 17),
        league_id: 301,
        league_name: "Ligue 1",
        image_url: null,
        url: "https://rmcsport.bfmtv.com/football/ligue-1/"
      },
      
      // General Football News
      {
        id: 35,
        title: "Champions League Draw Announced",
        summary: "The Champions League knockout stage draw has been completed with several exciting matchups confirmed.",
        source: "UEFA",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 18),
        league_id: null,
        league_name: "Champions League",
        image_url: null,
        url: "https://www.uefa.com/uefachampionsleague/"
      },
      {
        id: 36,
        title: "World Cup Qualifiers Update",
        summary: "Latest results and standings from the ongoing World Cup qualification matches across different confederations.",
        source: "FIFA",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 19),
        league_id: null,
        league_name: "International",
        image_url: null,
        url: "https://www.fifa.com/worldcup/"
      }
    ];
    
    const news = mockNews
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      .slice(0, limit);
    
    res.json(news);
  } catch (err) {
    console.error('getNews error:', err);
    res.status(500).json({ error: 'Failed to get news' });
  }
};

/**
 * GET /api/news/league/:leagueId
 * Returns news for a specific league from SportMonks API
 */
exports.getNewsForLeague = async (req, res) => {
  try {
    const leagueId = req.params.leagueId;
    await policy.assertPublicCompetition(leagueId);
    return res.json(await aggregateFeeds({ leagueId, limit: Math.min(parseInt(req.query.limit) || 20, 50) }));
  } catch (error) {
    return res.status(error.statusCode || error.status || 500).json({ error: error.message });
  }
};

async function legacyLeagueNews(req, res) {
  try {
    const { leagueId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const { getLeagueMetadata } = require('../config/rssFeeds');
    
    
    try {
      // Use RSS aggregator with league filtering
      const articles = await aggregateFeeds({ leagueId: parseInt(leagueId), limit });
      
      if (articles && articles.length > 0) {
        const leagueMetadata = getLeagueMetadata(leagueId);
        
        // Transform to match frontend format
        const news = articles.map(article => ({
          id: article.id,
          title: article.title,
          summary: article.summary,
          source: article.source,
          published_at: article.published_at,
          league_id: parseInt(leagueId),
          league_name: leagueMetadata ? leagueMetadata.displayName : null,
          image_url: article.image_url,
          url: article.url
        }));
        
        // Filter out any articles with category page URLs
        const { isCategoryPageUrl } = require('../utils/rssAggregator');
        const filteredNews = news.filter(article => !isCategoryPageUrl(article.url));
        
        return res.json(filteredNews);
      }
    } catch (rssError) {
      console.error(`[news] RSS aggregator error for league ${leagueId}:`, rssError.message);
    }
    
    
    // NOTE: SportMonks news endpoints return 403 Forbidden - news access not included in plan
    // Using comprehensive mock data with correct league IDs from your database
    
    
    // Comprehensive mock data with correct league IDs from your database
      const mockNews = [
        // Premier League (8)
        {
          id: 1,
          title: "Premier League Transfer Window Updates",
          summary: "Latest transfer news and rumors from the Premier League as clubs prepare for the upcoming window.",
          source: "BBC Sport",
          published_at: new Date(Date.now() - 1000 * 60 * 30),
          league_id: 8,
          league_name: "Premier League",
          image_url: null,
          url: "https://www.bbc.com/sport/football/premier-league"
        },
        {
          id: 32,
          title: "Manchester City's Title Defense Strategy",
          summary: "Pep Guardiola discusses his tactical approach for retaining the Premier League title.",
          source: "Sky Sports",
          published_at: new Date(Date.now() - 1000 * 60 * 60 * 42),
          league_id: 8,
          league_name: "Premier League",
          image_url: null,
          url: "https://www.skysports.com/premier-league"
        },
        
        // La Liga (564)
        {
          id: 3,
          title: "La Liga Title Race Heating Up",
          summary: "With just months left in the season, the race for the La Liga title is intensifying between the top clubs.",
          source: "ESPN",
          published_at: new Date(Date.now() - 1000 * 60 * 60 * 4),
          league_id: 564,
          league_name: "La Liga",
          image_url: null,
          url: "https://www.espn.com/soccer/league/_/name/esp.1"
        },
        {
          id: 24,
          title: "Atletico Madrid's Defensive Masterclass",
          summary: "Diego Simeone's tactical approach continues to frustrate opponents across La Liga.",
          source: "AS",
          published_at: new Date(Date.now() - 1000 * 60 * 60 * 26),
          league_id: 564,
          league_name: "La Liga",
          image_url: null,
          url: "https://as.com/futbol/primera/"
        },
        
        // Bundesliga (82)
        {
          id: 4,
          title: "Bundesliga Weekend Preview",
          summary: "A look ahead to this weekend's Bundesliga fixtures with key matchups and players to watch.",
          source: "Sky Sports",
          published_at: new Date(Date.now() - 1000 * 60 * 60 * 6),
          league_id: 82,
          league_name: "Bundesliga",
          image_url: null,
          url: "https://www.skysports.com/bundesliga"
        },
        {
          id: 20,
          title: "Borussia Dortmund's Champions League Hopes",
          summary: "Dortmund looks to secure their Champions League qualification spot with strong performances.",
          source: "ESPN",
          published_at: new Date(Date.now() - 1000 * 60 * 60 * 16),
          league_id: 82,
          league_name: "Bundesliga", 
          image_url: null,
          url: "https://www.espn.com/soccer/league/_/name/ger.1"
        },
        
        // Championship (9)
        {
          id: 17,
          title: "Championship Promotion Race Intensifies",
          summary: "The battle for promotion to the Premier League is heating up with several teams in contention.",
          source: "BBC Sport",
          published_at: new Date(Date.now() - 1000 * 60 * 60 * 13),
          league_id: 9,
          league_name: "Championship",
          image_url: null,
          url: "https://www.bbc.com/sport/football/articles/c123456789championship3"
        },
        {
          id: 28,
          title: "Leicester City's Championship Dominance",
          summary: "The Foxes continue their impressive form as they push for immediate Premier League return.",
          source: "BBC Sport",
          published_at: new Date(Date.now() - 1000 * 60 * 60 * 34),
          league_id: 9,
          league_name: "Championship",
          image_url: null,
          url: "https://www.bbc.com/sport/football/articles/c123456789championship4"
        },
        
        // Serie A (384)
        {
          id: 5,
          title: "Serie A Tactical Analysis",
          summary: "Breaking down the tactical trends and innovations in Serie A this season.",
          source: "Football Italia",
          published_at: new Date(Date.now() - 1000 * 60 * 60 * 8),
          league_id: 384,
          league_name: "Serie A",
          image_url: null,
          url: "https://www.football-italia.net/"
        },
        
        // Ligue 1 (301)
        {
          id: 15,
          title: "PSG Dominance in Ligue 1 Continues",
          summary: "Paris Saint-Germain maintains their strong position at the top of Ligue 1 with consistent performances.",
          source: "L'Equipe",
          published_at: new Date(Date.now() - 1000 * 60 * 60 * 11),
          league_id: 301,
          league_name: "Ligue 1",
          image_url: null,
          url: "https://www.lequipe.fr/Football/Ligue-1/"
        }
      ];
      
      const targetLeagueId = parseInt(leagueId);
      
      // Filter mock news by league ID
      const filteredNews = mockNews
        .filter(article => article.league_id === targetLeagueId)
        .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
        .slice(0, limit);
      
    res.json(filteredNews);
    
  } catch (err) {
    console.error('getNewsForLeague error:', err);
    res.status(500).json({ error: 'Failed to get league news' });
  }
}

/**
 * GET /api/news/team/:teamId
 * Returns news for a specific team
 */
exports.getNewsForTeam = async (req, res) => {
  try {
    const { teamId } = req.params;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit) || 20, 50));
    
    
    // Try to find the team in the database to get the proper team name and slug
    const publicTeam = await policy.assertPublicTeam(teamId);
    let teamSearchTerm = publicTeam.name;
    let teamSlug = publicTeam.slug;
    let teamName = null;
    
    // Public reports are those linked from a match; V4 does not set status=final.
    const reports = await Report.aggregate([
      ...await publicReportStages(teamSlug),
      { $sort: { createdAt: -1, _id: 1 } },
      { $limit: limit },
      { $project: {
        match_id: 1, team_id: 1, team_slug: 1, headline: 1,
        'generated.headline': 1, 'generated.summary_paragraphs': 1,
        summary_paragraphs: 1, images: 1, createdAt: 1, 'competition.name': 1
      } }
    ]);
    const reportNews = reports.map(report => ({
      id: `report-${report._id}`,
      kind: 'match-report',
      title: report.generated?.headline?.trim() || report.headline,
      summary: report.generated?.summary_paragraphs?.[0] || report.summary_paragraphs?.[0] || '',
      source: 'The Replay',
      published_at: report.createdAt,
      league_id: null,
      league_name: report.competition?.name || null,
      team_id: report.team_id,
      image_url: report.images?.[0] || null,
      url: `https://thereplay.app/${encodeURIComponent(report.team_slug)}/match/${report.match_id}/report`
    }));

    let news = [];
    try {
      const Team = require('../models/Team');
      const team = await Team.findOne({ slug: teamId }).lean();
      if (team && team.name) {
        teamSearchTerm = team.name; // Use the full team name for better matching
        teamSlug = team.slug; // Use slug
        teamName = team.name;
      } else {
        // Convert slug-like input to more readable format
        teamSearchTerm = teamId.replace(/-/g, ' ');
      }
    } catch (dbError) {
      console.warn(`[news] Database lookup failed, using identifier as-is: ${teamId}`);
      teamSearchTerm = teamId.replace(/-/g, ' ');
    }
    
    
    try {
      // Use the RSS aggregator with the team name
      // Pass both slug and name to improve matching - the aggregator will try both
      const articles = await aggregateFeeds({ teamId: teamSearchTerm, teamSlug: teamSlug, limit });
      
      if (articles && articles.length > 0) {
        // Transform to match frontend format
        news = articles.map(article => ({
          id: article.id,
          title: article.title,
          summary: article.summary,
          source: article.source,
          published_at: article.published_at,
          source_published_at: article.source_published_at,
          league_id: null,
          league_name: null,
          team_id: teamSearchTerm,
          image_url: article.image_url,
          url: article.url
        }));
        
      }
    } catch (rssError) {
      console.error(`[news] RSS aggregator error for team ${teamSearchTerm}:`, rssError.message);
      console.error(`[news] Error stack:`, rssError.stack);
    }
    
    const seen = new Set();
    const merged = [...reportNews, ...news].filter(article => {
      if (seen.has(article.url)) return false;
      seen.add(article.url);
      return true;
    }).sort((a, b) => {
      const dateDifference = (Date.parse(b.published_at) || 0) - (Date.parse(a.published_at) || 0);
      if (dateDifference) return dateDifference;
      const aKey = `${a.url}\n${a.id || ''}`;
      const bKey = `${b.url}\n${b.id || ''}`;
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });
    const collection = merged.slice(0, limit);
    await recordNewsSnapshot(`/${encodeURIComponent(teamSlug)}/news`, collection, limit);
    res.json(collection);
    
  } catch (err) {
    console.error('getNewsForTeam error:', err);
    res.status(500).json({ error: 'Failed to get team news' });
  }
};

/**
 * GET /api/news/search
 * Search news articles with multiple filter options
 */
exports.searchNews = async (req, res) => {
  try {
    const { leagueId, teamId, keyword, limit: queryLimit } = req.query;
    const limit = Math.min(parseInt(queryLimit) || 20, 50);
    
    
    try {
      // Use RSS aggregator with multiple filters
      const articles = await aggregateFeeds({ 
        leagueId: leagueId ? parseInt(leagueId) : null,
        teamId,
        keyword,
        limit 
      });
      
      if (articles && articles.length > 0) {
        const { getLeagueMetadata } = require('../config/rssFeeds');
        
        // Transform to match frontend format
        const news = articles.map(article => ({
          id: article.id,
          title: article.title,
          summary: article.summary,
          source: article.source,
          published_at: article.published_at,
          league_id: leagueId ? parseInt(leagueId) : null,
          league_name: leagueId ? getLeagueMetadata(leagueId)?.displayName : null,
          team_id: teamId || null,
          image_url: article.image_url,
          url: article.url
        }));
        
        return res.json(news);
      }
    } catch (rssError) {
      console.error(`[news] RSS aggregator error for search:`, rssError.message);
    }
    
    res.json([]);
    
  } catch (err) {
    console.error('searchNews error:', err);
    res.status(500).json({ error: 'Failed to search news' });
  }
};

/**
 * GET /api/news/metadata
 * Get available leagues and teams for filtering
 */
exports.getNewsMetadata = async (req, res) => {
  try {
    const { leagueMetadata, teamKeywords, getAllTeams } = require('../config/rssFeeds');
    
    // Format leagues
    const leagues = Object.keys(leagueMetadata).filter(id => req.coverage.competitionIds.includes(Number(id))).map(id => ({
      id: parseInt(id),
      name: leagueMetadata[id].name,
      country: leagueMetadata[id].country,
      displayName: leagueMetadata[id].displayName
    }));
    
    // Group leagues by country for potential country-first filtering
    const leaguesByCountry = leagues.reduce((acc, league) => {
      if (!acc[league.country]) {
        acc[league.country] = [];
      }
      acc[league.country].push(league);
      return acc;
    }, {});
    
    // Get unique countries
    const countries = Object.keys(leaguesByCountry).map(country => ({
      name: country,
      leagues: leaguesByCountry[country]
    }));
    
    // Format teams
    const teams = req.coverage.teams.map(team => ({ ...team, supported: true, keywords: teamKeywords[team.slug] || [] }));
    
    res.json({
      success: true,
      data: {
        leagues,
        countries,
        leaguesByCountry,
        teams,
        totalLeagues: leagues.length,
        totalCountries: countries.length,
        totalTeams: teams.length
      }
    });
    
  } catch (err) {
    console.error('getNewsMetadata error:', err);
    res.status(500).json({ error: 'Failed to get news metadata' });
  }
};

/**
 * GET /api/news/test-rss
 * Test endpoint to debug RSS aggregator issues
 */
exports.testRssAggregator = async (req, res) => {
  try {
    const { getCacheStats } = require('../utils/rssAggregator');
    const RssFeed = require('../models/RssFeed');
    
    
    const enabledFeeds = await RssFeed.getEnabledFeeds();
    const cacheStats = getCacheStats();
    
    // Try to fetch just 2 articles as a test
    const articles = await aggregateFeeds({ limit: 2, useCache: false });
    
    res.json({
      status: 'success',
      enabledFeeds: enabledFeeds.length,
      feedNames: enabledFeeds.map(f => f.name),
      cacheStats,
      articlesFound: articles.length,
      sampleArticles: articles.slice(0, 2).map(a => ({
        title: a.title,
        source: a.source,
        url: a.url
      }))
    });
    
  } catch (error) {
    console.error('[news:test] RSS test error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      stack: error.stack
    });
  }
};

/**
 * GET /api/news/rss
 * Optional query: leagueId (number)
 * Returns an RSS feed (application/rss+xml) built from SportMonks news or fallback mock data
 */
exports.getNewsRss = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    const leagueId = req.query.leagueId || null;

    // Choose endpoint based on presence of leagueId
    const path = leagueId ? `/leagues/${leagueId}/news` : '/news';


    const articles = (await aggregateFeeds({ leagueId, limit })).map(article => ({
      ...article, description: article.summary, link: article.url, image: article.image_url
    }));

    // Build RSS XML
    const feedTitle = leagueId ? `News for league ${leagueId}` : 'Latest Football News';
    const feedLink = req.protocol + '://' + req.get('host') + req.originalUrl;
    const feedDesc = 'Aggregated football news feed';

    const itemsXml = articles
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      .slice(0, limit)
      .map(a => {
        const pubDate = new Date(a.published_at).toUTCString();
        const guid = `${a.id}-${a.published_at ? new Date(a.published_at).getTime() : '0'}`;
        const description = (a.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const title = (a.title || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const link = a.link;
        const enclosure = a.image ? `<enclosure url="${a.image}" type="image/jpeg" />` : '';
        return `  <item>\n    <title>${title}</title>\n    <link>${link}</link>\n    <guid isPermaLink="false">${guid}</guid>\n    <pubDate>${pubDate}</pubDate>\n    <description>${description}</description>\n    ${enclosure}\n  </item>`;
      })
      .join('\n');

    const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>${feedTitle}</title>\n  <link>${feedLink}</link>\n  <description>${feedDesc}</description>\n${itemsXml}\n</channel>\n</rss>`;

    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(rss);
  } catch (err) {
    console.error('[news:rss] error:', err);
    res.status(500).send('Failed to generate RSS feed');
  }
};