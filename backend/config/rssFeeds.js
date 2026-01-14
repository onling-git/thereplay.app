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
    id: 'bbc-sport-all',
    name: 'BBC Sport All',
    url: 'http://feeds.bbci.co.uk/sport/rss.xml',
    enabled: true,
    priority: 1,
    keywords: ['football', 'soccer', 'premier league', 'championship', 'fa cup']
  },
  {
    id: 'bbc-premier-league',
    name: 'BBC Premier League',
    url: 'http://feeds.bbci.co.uk/sport/football/premier-league/rss.xml',
    enabled: true,
    priority: 1,
    keywords: ['premier league', 'southampton', 'saints', 'manchester city', 'liverpool', 'arsenal']
  },
  {
    id: 'bbc-championship',
    name: 'BBC Championship',
    url: 'http://feeds.bbci.co.uk/sport/football/championship/rss.xml',
    enabled: true,
    priority: 2,
    keywords: ['championship', 'efl', 'leicester', 'leeds', 'norwich', 'reading', 'burnley', 'southampton', 'hull', 'stoke', 'bristol city', 'coventry', 'west brom', 'sheffield united', 'luton', 'ipswich', 'cardiff', 'swansea', 'watford', 'blackburn', 'millwall', 'preston', 'wycombe', 'middlesbrough', 'bolton', 'stockport', 'wrexham', 'exeter', 'peterborough', 'plymouth', 'rotherham', 'birmingham']
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
    id: 'bbc-efl',
    name: 'BBC EFL/Championship',
    url: 'http://feeds.bbci.co.uk/sport/football/championship/rss.xml',
    enabled: true,
    priority: 2,
    keywords: ['championship', 'efl', 'southampton', 'reading', 'burnley', 'leeds', 'leicester', 'norwich']
  },
  {
    id: 'sky-sports-efl',
    name: 'Sky Sports EFL/Championship',
    url: 'https://www.skysports.com/rss/143',
    enabled: true,
    priority: 2,
    keywords: ['championship', 'efl', 'southampton', 'reading', 'burnley', 'leeds', 'leicester', 'norwich']
  },
  {
    id: 'football-league',
    name: 'Football League Official',
    url: 'https://www.efl.com/news/feed/',
    enabled: true,
    priority: 3,
    keywords: ['championship', 'league one', 'league two', 'efl', 'southampton', 'reading', 'burnley']
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

// League metadata with smart naming (country prefix only for duplicates)
const leagueMetadata = {
  // English leagues
  8: {
    name: 'Premier League',
    country: 'England',
    displayName: 'English Premier League',
    keywords: ['premier league', 'epl', 'english premier league']
  },
  486: {
    name: 'Premier League',
    country: 'Russia',
    displayName: 'Russian Premier League',
    keywords: ['russian premier league', 'rpl', 'russia league']
  },
  609: {
    name: 'Premier League',
    country: 'Ukraine',
    displayName: 'Ukrainian Premier League',
    keywords: ['ukrainian premier league', 'ukraine league', 'premier league']
  },
  9: {
    name: 'Championship',
    country: 'England',
    displayName: 'English Championship',
    keywords: ['championship', 'efl championship', 'championship playoff', 'english championship', 'championship table', 'championship promotion', 'leicester city', 'leeds united', 'norwich city', 'cardiff city', 'swansea city', 'middlesbrough', 'hull city', 'coventry city']
  },
  24: {
    name: 'FA Cup',
    country: 'England',
    displayName: 'FA Cup',
    keywords: ['fa cup', 'english fa cup', 'cup final']
  },
  
  // Spanish leagues (unique names)
  564: {
    name: 'La Liga',
    country: 'Spain',
    displayName: 'La Liga',
    keywords: ['la liga', 'laliga', 'spanish league', 'el clasico']
  },
  567: {
    name: 'La Liga 2',
    country: 'Spain',
    displayName: 'La Liga 2',
    keywords: ['la liga 2', 'segunda division', 'spanish second division']
  },
  
  // German leagues (unique names)
  82: {
    name: 'Bundesliga',
    country: 'Germany',
    displayName: 'Bundesliga',
    keywords: ['bundesliga', 'german league']
  },
  181: {
    name: 'Admiral Bundesliga',
    country: 'Austria',
    displayName: 'Austrian Bundesliga',
    keywords: ['admiral bundesliga', 'austrian league']
  },
  
  // Italian leagues (unique names)
  384: {
    name: 'Serie A',
    country: 'Italy',
    displayName: 'Serie A',
    keywords: ['serie a', 'italian league']
  },
  387: {
    name: 'Serie B',
    country: 'Italy',
    displayName: 'Serie B',
    keywords: ['serie b', 'italian second division']
  },
  
  // French leagues (unique names)
  301: {
    name: 'Ligue 1',
    country: 'France',
    displayName: 'Ligue 1',
    keywords: ['ligue 1', 'french league']
  },
  
  // Netherlands
  72: {
    name: 'Eredivisie',
    country: 'Netherlands',
    displayName: 'Eredivisie',
    keywords: ['eredivisie', 'dutch league']
  },
  
  // Portugal
  462: {
    name: 'Liga Portugal',
    country: 'Portugal',
    displayName: 'Liga Portugal',
    keywords: ['liga portugal', 'portuguese league']
  },
  
  // Belgium  
  208: {
    name: 'Pro League',
    country: 'Belgium',
    displayName: 'Belgian Pro League',
    keywords: ['pro league', 'belgian league']
  },
  
  // Scotland
  501: {
    name: 'Premiership',
    country: 'Scotland',
    displayName: 'Scottish Premiership',
    keywords: ['scottish premiership', 'scotland league']
  },
  
  // Poland
  453: {
    name: 'Ekstraklasa',
    country: 'Poland',
    displayName: 'Ekstraklasa',
    keywords: ['ekstraklasa', 'polish league']
  },
  
  // Norway
  444: {
    name: 'Eliteserien',
    country: 'Norway',
    displayName: 'Eliteserien',
    keywords: ['eliteserien', 'norwegian league']
  },
  
  // Sweden
  573: {
    name: 'Allsvenskan',
    country: 'Sweden',
    displayName: 'Allsvenskan',
    keywords: ['allsvenskan', 'swedish league']
  },
  
  // Turkey
  600: {
    name: 'Super Lig',
    country: 'Turkey',
    displayName: 'Turkish Super Lig',
    keywords: ['super lig', 'turkish league']
  },
  
  // Denmark
  271: {
    name: 'Superliga',
    country: 'Denmark',
    displayName: 'Danish Superliga',
    keywords: ['superliga', 'danish league']
  },
  
  // Switzerland
  591: {
    name: 'Super League',
    country: 'Switzerland',
    displayName: 'Swiss Super League',
    keywords: ['swiss super league', 'switzerland league']
  },
  
  // Croatia
  244: {
    name: '1. HNL',
    country: 'Croatia',
    displayName: 'Croatian 1. HNL',
    keywords: ['hnl', 'croatian league']
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
  'southampton': ['southampton', 'saints', 'st marys', 'st mary\'s stadium', 'southampton fc'],
  'crystal-palace': ['crystal palace', 'palace', 'eagles', 'selhurst park'],
  'fulham': ['fulham', 'cottagers', 'craven cottage'],
  'brentford': ['brentford', 'bees', 'gtech community stadium'],
  'wolves': ['wolves', 'wolverhampton', 'wanderers', 'molineux'],
  'everton': ['everton', 'toffees', 'goodison park'],
  'nottingham-forest': ['nottingham forest', 'forest', 'city ground'],
  'bournemouth': ['bournemouth', 'cherries', 'vitality stadium'],
  'luton': ['luton', 'luton town', 'hatters', 'kenilworth road'],
  'burnley': ['burnley', 'clarets', 'turf moor'],
  
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
  'norwich': ['norwich', 'norwich city', 'canaries'],
  'reading': ['reading', 'reading fc', 'royals', 'madejski stadium'],
  'burnley': ['burnley', 'clarets', 'turf moor', 'burnley fc'],
  'southampton': ['southampton', 'saints', 'st marys', 'st mary\'s stadium', 'southampton fc'],
  'sheffield-united': ['sheffield united', 'blades', 'bramall lane'],
  'hull-city': ['hull city', 'hull', 'tigers', 'kcom stadium'],
  'stoke-city': ['stoke city', 'stoke', 'potters', 'britannia'],
  'bristol-city': ['bristol city', 'bristol', 'robins', 'ashton gate'],
  'coventry': ['coventry', 'coventry city', 'sky blues'],
  'west-brom': ['west brom', 'west bromwich albion', 'baggies', 'the hawthorns'],
  'ipswich-town': ['ipswich town', 'ipswich', 'portman road', 'tractor boys'],
  'cardiff-city': ['cardiff city', 'cardiff', 'bluebirds'],
  'swansea': ['swansea', 'swansea city', 'swans'],
  'watford': ['watford', 'watford fc', 'hornets', 'vicarage road'],
  'blackburn': ['blackburn', 'blackburn rovers', 'rovers', 'ewood park'],
  'millwall': ['millwall', 'lions', 'the den'],
  'preston': ['preston', 'preston north end', 'north end', 'deepdale'],
  'wycombe': ['wycombe', 'wycombe wanderers', 'wanderers', 'adams park'],
  'middlesbrough': ['middlesbrough', 'boro', 'riverside stadium'],
  'bolton': ['bolton', 'bolton wanderers', 'wanderers', 'university of bolton stadium'],
  'stockport': ['stockport', 'stockport county', 'county', 'edgeley park'],
  'wrexham': ['wrexham', 'wrexham afc', 'red dragons'],
  'exeter': ['exeter', 'exeter city', 'grecians'],
  'peterborough': ['peterborough', 'peterborough united', 'posh'],
  'plymouth': ['plymouth', 'plymouth argyle', 'argyle', 'home park'],
  'rotherham': ['rotherham', 'rotherham united', 'millers'],
  'birmingham': ['birmingham', 'birmingham city', 'blues', 'st andrews']
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
  },
  
  // Additional sport exclusion patterns for better filtering
  sportExclusions: {
    // These patterns will cause immediate exclusion if found in title or summary
    strongExclusions: [
      'nba', 'nfl', 'mlb', 'nhl', 'wnba', 'mls',
      'basketball', 'baseball', 'american football', 'hockey',
      'tennis', 'golf', 'cricket', 'rugby', 'boxing', 'formula 1'
    ],
    
    // These require additional context checks
    contextualExclusions: [
      'playoffs', 'championship game', 'world series', 'super bowl',
      'stanley cup', 'grand slam', 'masters', 'wimbledon'
    ]
  }
};