const Match = require('../models/Match');

/**
 * GET /api/news
 * Returns mock news articles - can be replaced with real news API integration
 */
exports.getNews = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    
    // Mock news data - in production this would come from a news API or database
    const mockNews = [
      {
        id: 1,
        title: "Premier League Transfer Window Updates",
        summary: "Latest transfer news and rumors from the Premier League as clubs prepare for the upcoming window.",
        source: "BBC Sport",
        published_at: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
        league_id: 39,
        league_name: "Premier League",
        image_url: null,
        url: "https://www.bbc.com/sport/football"
      },
      {
        id: 2,
        title: "Champions League Draw Announced",
        summary: "The Champions League knockout stage draw has been completed with several exciting matchups confirmed.",
        source: "UEFA",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        league_id: null,
        league_name: "Champions League",
        image_url: null,
        url: "https://www.uefa.com/uefachampionsleague/"
      },
      {
        id: 3,
        title: "La Liga Title Race Heating Up",
        summary: "With just months left in the season, the race for the La Liga title is intensifying between the top clubs.",
        source: "ESPN",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 4), // 4 hours ago
        league_id: 140,
        league_name: "La Liga",
        image_url: null,
        url: "https://www.espn.com/soccer/league/_/name/esp.1"
      },
      {
        id: 4,
        title: "Bundesliga Weekend Preview",
        summary: "A look ahead to this weekend's Bundesliga fixtures with key matchups and players to watch.",
        source: "Sky Sports",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 6), // 6 hours ago
        league_id: 78,
        league_name: "Bundesliga",
        image_url: null,
        url: "https://www.skysports.com/bundesliga"
      },
      {
        id: 5,
        title: "Serie A Tactical Analysis",
        summary: "Breaking down the tactical trends and innovations in Serie A this season.",
        source: "Football Italia",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 8), // 8 hours ago
        league_id: 135,
        league_name: "Serie A",
        image_url: null,
        url: "https://www.football-italia.net/"
      }
    ];
    
    // Sort by published date (newest first) and limit
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
 * Returns news for a specific league
 */
exports.getNewsForLeague = async (req, res) => {
  try {
    const { leagueId } = req.params;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);
    
    console.log(`[news] Filtering by league ID: ${leagueId}`);
    
    // Expanded mock news data with correct league IDs from your database
    const mockNews = [
      // Premier League (8, 486, 609 - using main one: 8)
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
        id: 6,
        title: "Premier League Injury Report",
        summary: "Latest injury updates for Premier League teams ahead of the weekend fixtures.",
        source: "BBC Sport",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 3),
        league_id: 8,
        league_name: "Premier League",
        image_url: null,
        url: "https://www.bbc.com/sport/football/premier-league"
      },
      {
        id: 11,
        title: "Premier League VAR Controversy Continues",
        summary: "The latest VAR decisions have sparked debate among fans and pundits across the Premier League.",
        source: "Sky Sports",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 5),
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
        id: 12,
        title: "Real Madrid vs Barcelona El Clasico Preview",
        summary: "A detailed look ahead to the upcoming El Clasico between Real Madrid and Barcelona.",
        source: "Marca",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 7),
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
        id: 13,
        title: "Bayern Munich Transfer Plans Revealed",
        summary: "Bayern Munich's board discusses their strategy for strengthening the squad in the upcoming transfer window.",
        source: "ESPN",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 9),
        league_id: 82,
        league_name: "Bundesliga",
        image_url: null,
        url: "https://www.espn.com/soccer/league/_/name/ger.1"
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
      {
        id: 14,
        title: "AC Milan vs Inter Milan Derby Preview",
        summary: "The Milan derby is set to be one of the most exciting matches of the Serie A season.",
        source: "Gazzetta dello Sport",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 10),
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
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 11),
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
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 12),
        league_id: 301,
        league_name: "Ligue 1",
        image_url: null,
        url: "https://rmcsport.bfmtv.com/football/ligue-1/"
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
        url: "https://www.bbc.com/sport/football/championship"
      },
      {
        id: 18,
        title: "Championship Transfer Roundup",
        summary: "A comprehensive look at the latest transfer activity across the Championship clubs.",
        source: "Sky Sports",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 14),
        league_id: 9,
        league_name: "Championship",
        image_url: null,
        url: "https://www.skysports.com/championship"
      },
      {
        id: 19,
        title: "Championship Playoff Picture Taking Shape",
        summary: "With the season progressing, the Championship playoff positions are becoming clearer.",
        source: "BBC Sport",
        published_at: new Date(Date.now() - 1000 * 60 * 60 * 15),
        league_id: 9,
        league_name: "Championship",
        image_url: null,
        url: "https://www.bbc.com/sport/football/championship"
      }
    ];
    
    const targetLeagueId = parseInt(leagueId);
    
    // Filter by league and sort by published date
    const news = mockNews
      .filter(article => article.league_id === targetLeagueId)
      .sort((a, b) => new Date(b.published_at) - new Date(a.published_at))
      .slice(0, limit);
    
    res.json(news);
  } catch (err) {
    console.error('getNewsForLeague error:', err);
    res.status(500).json({ error: 'Failed to get league news' });
  }
};