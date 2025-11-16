/**
 * RSS Feed Configuration
 * Add or remove RSS feeds here - the aggregator will automatically fetch from all enabled feeds
 */

const rssFeeds = [
  {
    id: 'bbc-football',
    name: 'BBC Sport Football',
    url: 'http://feeds.bbci.co.uk/sport/football/rss.xml',
    enabled: true,
    priority: 1, // Higher priority sources appear first
    keywords: ['premier league', 'championship', 'la liga', 'bundesliga', 'serie a', 'ligue 1', 'football', 'soccer']
  },
  {
    id: 'espn-soccer',
    name: 'ESPN Soccer',
    url: 'https://www.espn.com/espn/rss/soccer/news',
    enabled: true,
    priority: 2,
    keywords: ['premier league', 'la liga', 'bundesliga', 'serie a', 'ligue 1', 'champions league', 'soccer']
  },
  {
    id: 'sky-sports-football',
    name: 'Sky Sports Football',
    url: 'https://www.skysports.com/rss/12040',
    enabled: true,
    priority: 3,
    keywords: ['premier league', 'championship', 'football', 'transfer', 'efl']
  },
  {
    id: 'football-italia',
    name: 'Football Italia',
    url: 'https://www.football-italia.net/rss.xml',
    enabled: true,
    priority: 4,
    keywords: ['serie a', 'italy', 'juventus', 'milan', 'inter', 'roma', 'napoli']
  },
  {
    id: 'marca-english',
    name: 'Marca English',
    url: 'https://www.marca.com/en/rss/en/football.xml',
    enabled: true,
    priority: 5,
    keywords: ['la liga', 'real madrid', 'barcelona', 'atletico', 'spain', 'el clasico']
  },
  {
    id: 'lequipe',
    name: 'L\'Equipe Football',
    url: 'https://www.lequipe.fr/rss/actu_rss_Football.xml',
    enabled: false, // Disabled by default (French content)
    priority: 6,
    keywords: ['ligue 1', 'psg', 'marseille', 'lyon', 'france']
  },
  {
    id: 'goal',
    name: 'Goal.com',
    url: 'https://www.goal.com/feeds/en/news',
    enabled: true,
    priority: 7,
    keywords: ['football', 'soccer', 'transfer', 'champions league', 'world cup']
  }
];

// League metadata with country flags and enhanced filtering
const leagueMetadata = {
  8: {
    name: 'Premier League',
    country: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    displayName: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
    keywords: ['premier league', 'epl', 'english premier league', 'england']
  },
  486: {
    name: 'Premier League',
    country: 'England', 
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    displayName: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
    keywords: ['premier league', 'epl', 'english premier league', 'england']
  },
  609: {
    name: 'Premier League',
    country: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 
    displayName: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League',
    keywords: ['premier league', 'epl', 'english premier league', 'england']
  },
  9: {
    name: 'Championship',
    country: 'England',
    flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    displayName: '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Championship',
    keywords: ['championship', 'efl championship', 'championship playoff', 'england']
  },
  564: {
    name: 'La Liga',
    country: 'Spain',
    flag: '🇪🇸',
    displayName: '🇪🇸 La Liga',
    keywords: ['la liga', 'laliga', 'spanish league', 'spain', 'el clasico']
  },
  82: {
    name: 'Bundesliga',
    country: 'Germany',
    flag: '🇩🇪',
    displayName: '🇩🇪 Bundesliga',
    keywords: ['bundesliga', 'german league', 'germany']
  },
  384: {
    name: 'Serie A',
    country: 'Italy',
    flag: '🇮🇹',
    displayName: '🇮🇹 Serie A',
    keywords: ['serie a', 'italian league', 'italy']
  },
  301: {
    name: 'Ligue 1',
    country: 'France',
    flag: '🇫🇷',
    displayName: '🇫🇷 Ligue 1',
    keywords: ['ligue 1', 'french league', 'france']
  }
};

// Team keywords for filtering articles by specific teams
const teamKeywords = {
  // Premier League teams
  'manchester-city': ['man city', 'manchester city', 'city', 'pep guardiola', 'etihad'],
  'manchester-united': ['man united', 'manchester united', 'united', 'old trafford', 'erik ten hag'],
  'arsenal': ['arsenal', 'gunners', 'emirates', 'mikel arteta'],
  'liverpool': ['liverpool', 'reds', 'anfield', 'jurgen klopp'],
  'chelsea': ['chelsea', 'blues', 'stamford bridge'],
  'tottenham': ['tottenham', 'spurs', 'tottenham hotspur', 'white hart lane'],
  'newcastle': ['newcastle', 'newcastle united', 'magpies', 'st james park'],
  'aston-villa': ['aston villa', 'villa', 'villa park'],
  'west-ham': ['west ham', 'hammers', 'london stadium'],
  'brighton': ['brighton', 'seagulls', 'brighton hove albion'],
  
  // La Liga teams  
  'real-madrid': ['real madrid', 'madrid', 'bernabeu', 'los blancos'],
  'barcelona': ['barcelona', 'barca', 'camp nou', 'blaugrana'],
  'atletico-madrid': ['atletico madrid', 'atletico', 'wanda metropolitano'],
  'sevilla': ['sevilla', 'sevilla fc'],
  'real-sociedad': ['real sociedad', 'sociedad'],
  'valencia': ['valencia', 'valencia cf'],
  
  // Bundesliga teams
  'bayern-munich': ['bayern munich', 'bayern', 'allianz arena'],
  'borussia-dortmund': ['borussia dortmund', 'dortmund', 'bvb', 'signal iduna park'],
  'rb-leipzig': ['rb leipzig', 'leipzig'],
  'eintracht-frankfurt': ['eintracht frankfurt', 'frankfurt'],
  
  // Serie A teams
  'juventus': ['juventus', 'juve', 'allianz stadium'],
  'ac-milan': ['ac milan', 'milan', 'san siro'],
  'inter-milan': ['inter milan', 'inter', 'internazionale'],
  'roma': ['roma', 'as roma'],
  'napoli': ['napoli', 'ssc napoli'],
  
  // Ligue 1 teams
  'psg': ['psg', 'paris saint-germain', 'paris sg', 'parc des princes'],
  'marseille': ['marseille', 'olympique marseille', 'om'],
  'lyon': ['lyon', 'olympique lyon', 'ol'],
  
  // Championship teams
  'leicester-city': ['leicester city', 'leicester', 'foxes'],
  'leeds-united': ['leeds united', 'leeds', 'elland road'],
  'norwich': ['norwich', 'norwich city', 'canaries']
};

// Legacy support - convert to new format
const leagueKeywords = {};
Object.keys(leagueMetadata).forEach(leagueId => {
  leagueKeywords[leagueId] = leagueMetadata[leagueId].keywords;
});

module.exports = {
  rssFeeds,
  leagueKeywords, // Legacy support
  leagueMetadata,
  teamKeywords,
  
  // Helper functions
  getEnabledFeeds: () => rssFeeds.filter(feed => feed.enabled),
  getFeedById: (id) => rssFeeds.find(feed => feed.id === id),
  getKeywordsForLeague: (leagueId) => leagueKeywords[parseInt(leagueId)] || [],
  getKeywordsForTeam: (teamId) => teamKeywords[teamId] || [],
  getLeagueMetadata: (leagueId) => leagueMetadata[parseInt(leagueId)] || null,
  getAllTeams: () => Object.keys(teamKeywords),
  
  // Configuration
  cache: {
    ttlMinutes: 15, // Cache RSS feeds for 15 minutes
    maxArticles: 100 // Maximum articles to cache per feed
  }
};