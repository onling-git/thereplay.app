// utils/jsonLdSchema.js
// Generate JSON-LD schema for football match reports

/**
 * Generate JSON-LD schema for a football match report
 * @param {Object} matchData - Match and report data
 * @param {string} matchData.headline - Report headline
 * @param {string} matchData.articleBody - Full report text
 * @param {string} matchData.reportUrl - URL of the match report page
 * @param {Date} matchData.publishedAt - Report publication date
 * @param {Date} matchData.modifiedAt - Last modification date
 * @param {Array<string>} matchData.images - Array of image URLs
 * @param {Array<string>} matchData.keywords - SEO keywords
 * @param {Object} matchData.match - Match details
 * @param {string} matchData.match.homeTeam - Home team name
 * @param {string} matchData.match.awayTeam - Away team name
 * @param {string} matchData.match.score - Match score (e.g., "2-1")
 * @param {Date} matchData.match.kickoffTime - Match start time
 * @param {string} matchData.match.venue - Stadium/venue name
 * @param {string} matchData.match.referee - Referee name (optional)
 * @param {string} matchData.match.league - League/competition name
 * @param {Array} matchData.match.events - Match events (goals, cards, subs)
 * @returns {string} JSON-LD script tag ready for HTML insertion
 */
function generateMatchReportJsonLd(matchData) {
  const {
    headline,
    articleBody,
    reportUrl,
    publishedAt,
    modifiedAt,
    images = [],
    keywords = [],
    match = {}
  } = matchData;

  // Ensure we have required dates
  const pubDate = publishedAt || new Date();
  const modDate = modifiedAt || publishedAt || new Date();

  // Base organization data for "The Replay"
  const organization = {
    "@type": "Organization",
    "name": "The Replay",
    "url": "https://thefinalplay.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://thefinalplay.com/assets/logo.png",
      "width": 600,
      "height": 200
    }
  };

  // Build the JSON-LD structure
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    "headline": headline,
    "image": images.length > 0 ? images.map(url => ({
      "@type": "ImageObject",
      "url": url,
      "width": 1200,
      "height": 675
    })) : [{
      "@type": "ImageObject", 
      "url": "https://thefinalplay.com/assets/default-match-image.jpg",
      "width": 1200,
      "height": 675
    }],
    "datePublished": pubDate.toISOString(),
    "dateModified": modDate.toISOString(),
    "author": organization,
    "publisher": organization,
    "articleBody": articleBody,
    "articleSection": "Sports",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": reportUrl
    },
    "keywords": keywords.join(", "),
    "about": {
      "@type": "SportsEvent",
      "name": `${match.homeTeam || 'Home'} vs ${match.awayTeam || 'Away'}`,
      "startDate": match.kickoffTime ? new Date(match.kickoffTime).toISOString() : pubDate.toISOString(),
      "location": {
        "@type": "Place",
        "name": match.venue || "Stadium",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": match.city || "",
          "addressCountry": match.country || "GB"
        }
      },
      "homeTeam": {
        "@type": "SportsTeam",
        "name": match.homeTeam || "Home Team"
      },
      "awayTeam": {
        "@type": "SportsTeam", 
        "name": match.awayTeam || "Away Team"
      },
      "sport": "Football",
      "competitor": [
        {
          "@type": "SportsTeam",
          "name": match.homeTeam || "Home Team"
        },
        {
          "@type": "SportsTeam",
          "name": match.awayTeam || "Away Team"
        }
      ]
    }
  };

  // Add score if available
  if (match.score) {
    jsonLd.about.result = {
      "@type": "SportsEvent",
      "name": `Final Score: ${match.score}`,
      "description": `${match.homeTeam || 'Home'} ${match.score} ${match.awayTeam || 'Away'}`
    };
  }

  // Add referee if available
  if (match.referee) {
    jsonLd.about.referee = {
      "@type": "Person",
      "name": match.referee
    };
  }

  // Add league/competition information
  if (match.league) {
    jsonLd.about.superEvent = {
      "@type": "SportsEvent",
      "name": match.league
    };
  }

  // Add match events (goals, cards, substitutions) if available
  if (match.events && Array.isArray(match.events) && match.events.length > 0) {
    jsonLd.about.subEvent = match.events.map(event => ({
      "@type": "SportsEvent",
      "name": `${event.type}: ${event.player || 'Unknown'}`,
      "startDate": match.kickoffTime ? 
        new Date(new Date(match.kickoffTime).getTime() + (event.minute * 60000)).toISOString() :
        pubDate.toISOString(),
      "description": `${event.minute}' - ${event.type}${event.player ? ` by ${event.player}` : ''}${event.info ? ` (${event.info})` : ''}`
    }));
  }

  // Add breadcrumb navigation
  jsonLd.breadcrumb = {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://thefinalplay.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Match Reports",
        "item": "https://thefinalplay.com/reports"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": headline,
        "item": reportUrl
      }
    ]
  };

  // Return as properly formatted script tag
  return `<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>`;
}

/**
 * Generate minimal JSON-LD for matches without full reports
 */
function generateMinimalMatchJsonLd(matchData) {
  const {
    homeTeam,
    awayTeam,
    score,
    kickoffTime,
    venue,
    league,
    matchUrl
  } = matchData;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    "name": `${homeTeam} vs ${awayTeam}`,
    "startDate": kickoffTime ? new Date(kickoffTime).toISOString() : new Date().toISOString(),
    "location": {
      "@type": "Place",
      "name": venue || "Stadium"
    },
    "homeTeam": {
      "@type": "SportsTeam",
      "name": homeTeam
    },
    "awayTeam": {
      "@type": "SportsTeam",
      "name": awayTeam  
    },
    "sport": "Football",
    "url": matchUrl
  };

  if (score) {
    jsonLd.result = {
      "@type": "SportsEvent",
      "name": `Final Score: ${score}`,
      "description": `${homeTeam} ${score} ${awayTeam}`
    };
  }

  if (league) {
    jsonLd.superEvent = {
      "@type": "SportsEvent", 
      "name": league
    };
  }

  return `<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>`;
}

/**
 * Extract match events from match data for JSON-LD
 */
function extractMatchEventsForJsonLd(match) {
  if (!match.events || !Array.isArray(match.events)) {
    return [];
  }

  return match.events
    .filter(event => ['goal', 'yellowcard', 'redcard', 'substitution', 'penalty'].includes(event.type?.toLowerCase()))
    .map(event => ({
      type: event.type,
      minute: event.minute,
      player: event.player,
      info: event.info,
      team: event.team
    }));
}

/**
 * Generate keywords from match and team data
 */
function generateKeywords(match, teamSlug) {
  const keywords = [];
  
  // Add team names
  if (match.home_team) keywords.push(match.home_team);
  if (match.away_team) keywords.push(match.away_team);
  
  // Add league/competition
  if (match.league) keywords.push(match.league);
  
  // Add generic football terms
  keywords.push('football', 'soccer', 'match report', 'live score');
  
  // Add team-specific terms
  if (teamSlug) {
    keywords.push(`${teamSlug} match`, `${teamSlug} report`);
  }
  
  // Add match type based on events
  if (match.events) {
    const hasGoals = match.events.some(e => e.type?.toLowerCase() === 'goal');
    const hasCards = match.events.some(e => ['yellowcard', 'redcard'].includes(e.type?.toLowerCase()));
    
    if (hasGoals) keywords.push('goals', 'scoring');
    if (hasCards) keywords.push('cards', 'disciplinary');
  }
  
  return [...new Set(keywords)]; // Remove duplicates
}

module.exports = {
  generateMatchReportJsonLd,
  generateMinimalMatchJsonLd,
  extractMatchEventsForJsonLd,
  generateKeywords
};