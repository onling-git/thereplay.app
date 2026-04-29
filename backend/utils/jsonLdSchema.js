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

/**
 * Generate comprehensive JSON-LD schema for live/completed sports events
 * Follows schema.org/SportsEvent standards for real-time and completed matches
 * @param {Object} matchData - Complete match data from database
 * @param {string} matchUrl - URL of the match live page
 * @param {string} teamSlug - Current team context (for breadcrumbs)
 * @returns {string} JSON-LD script tag ready for HTML insertion
 */
function generateLiveMatchJsonLd(matchData, matchUrl, teamSlug = null) {
  if (!matchData) return '';

  const now = new Date();
  const matchStart = matchData.match_info?.starting_at ? new Date(matchData.match_info.starting_at) : now;
  const isLive = isMatchLive(matchData);
  const isCompleted = isMatchCompleted(matchData);
  
  // Determine event status based on match state
  let eventStatus = "EventScheduled"; // Default for upcoming matches
  if (isLive) {
    eventStatus = "EventLive";
  } else if (isCompleted) {
    eventStatus = "EventCompleted";
  }

  // Base organization data
  const organization = {
    "@type": "Organization",
    "name": "The Final Play",
    "url": "https://thefinalplay.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://thefinalplay.com/assets/logo.png",
      "width": 600,
      "height": 200
    }
  };

  // Build comprehensive sports event schema
  const sportsEvent = {
    "@context": "https://schema.org",
    "@type": "SportsEvent", 
    "@id": matchUrl,
    "name": `${matchData.teams?.home?.team_name || 'Home'} vs ${matchData.teams?.away?.team_name || 'Away'}`,
    "url": matchUrl,
    "startDate": matchStart.toISOString(),
    "eventStatus": `https://schema.org/${eventStatus}`,
    "sport": "Football",
    
    // Teams
    "homeTeam": {
      "@type": "SportsTeam",
      "@id": `https://thefinalplay.com/${matchData.teams?.home?.team_slug || 'home'}`,
      "name": matchData.teams?.home?.team_name || 'Home Team',
      "url": `https://thefinalplay.com/${matchData.teams?.home?.team_slug || 'home'}`
    },
    "awayTeam": {
      "@type": "SportsTeam", 
      "@id": `https://thefinalplay.com/${matchData.teams?.away?.team_slug || 'away'}`,
      "name": matchData.teams?.away?.team_name || 'Away Team',
      "url": `https://thefinalplay.com/${matchData.teams?.away?.team_slug || 'away'}`
    },
    
    // Competitors (required for some search engines)
    "competitor": [
      {
        "@type": "SportsTeam",
        "name": matchData.teams?.home?.team_name || 'Home Team'
      },
      {
        "@type": "SportsTeam",
        "name": matchData.teams?.away?.team_name || 'Away Team'
      }
    ],

    // Venue information
    "location": {
      "@type": "Place",
      "name": matchData.match_info?.venue?.name || "Stadium",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": matchData.match_info?.venue?.city_name || "",
        "addressCountry": "GB"
      }
    },

    // Publisher/organizer
    "organizer": organization,
    "publisher": organization
  };

  // Add league/competition context
  if (matchData.match_info?.league?.name) {
    sportsEvent.superEvent = {
      "@type": "SportsEvent",
      "name": matchData.match_info.league.name,
      "url": `https://thefinalplay.com/leagues/${matchData.match_info.league.id}`
    };
  }

  // Add referee if available  
  if (matchData.match_info?.referee?.name) {
    sportsEvent.referee = {
      "@type": "Person", 
      "name": matchData.match_info.referee.name
    };
  }

  // Add current score for live/completed matches
  if (matchData.score && (isLive || isCompleted)) {
    sportsEvent.homeTeamScore = matchData.score.home || 0;
    sportsEvent.awayTeamScore = matchData.score.away || 0;
    
    // Result description
    sportsEvent.result = {
      "@type": "SportsEvent",
      "name": `Score: ${matchData.score.home || 0}-${matchData.score.away || 0}`,
      "description": `${matchData.teams?.home?.team_name || 'Home'} ${matchData.score.home || 0}-${matchData.score.away || 0} ${matchData.teams?.away?.team_name || 'Away'}`
    };
  }

  // Add live match specifics
  if (isLive) {
    // Current match minute
    if (matchData.minute) {
      sportsEvent.duration = `PT${matchData.minute}M`;
    }
    
    // Match status description
    if (matchData.match_status?.name) {
      sportsEvent.description = `Live: ${matchData.match_status.name}${matchData.minute ? ` - ${matchData.minute}'` : ''}`;
    }
  }

  // Add match events as sub-events (goals, cards, substitutions)
  if (matchData.events && Array.isArray(matchData.events) && matchData.events.length > 0) {
    const significantEvents = matchData.events.filter(event => {
      const type = (event.type || '').toLowerCase();
      return ['goal', 'owngoal', 'own_goal', 'yellowcard', 'yellow_card', 
              'redcard', 'red_card', 'substitution', 'sub', 'penalty'].includes(type);
    });

    if (significantEvents.length > 0) {
      sportsEvent.subEvent = significantEvents.map(event => {
        const eventTime = matchStart.getTime() + ((event.minute || 0) * 60000);
        const eventDate = new Date(eventTime);
        
        return {
          "@type": "SportsEvent",
          "name": `${event.type}: ${event.player_name || event.player || 'Unknown'}`,
          "startDate": eventDate.toISOString(),
          "description": `${event.minute || 0}' - ${event.type}${event.player_name || event.player ? ` by ${event.player_name || event.player}` : ''}${event.info ? ` (${event.info})` : ''}`,
          "performer": event.player_name || event.player ? {
            "@type": "Person",
            "name": event.player_name || event.player
          } : undefined
        };
      });
    }
  }

  // Add breadcrumb navigation
  const breadcrumbs = {
    "@type": "BreadcrumbList", 
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://thefinalplay.com"
      }
    ]
  };

  // Add team-specific breadcrumb if we have team context
  if (teamSlug && matchData.teams) {
    const contextTeam = matchData.teams.home?.team_slug === teamSlug ? 
      matchData.teams.home : matchData.teams.away;
    
    if (contextTeam) {
      breadcrumbs.itemListElement.push({
        "@type": "ListItem",
        "position": 2,
        "name": contextTeam.team_name,
        "item": `https://thefinalplay.com/${contextTeam.team_slug}`
      });
      
      breadcrumbs.itemListElement.push({
        "@type": "ListItem",
        "position": 3,
        "name": "Live Match",
        "item": matchUrl
      });
    }
  } else {
    // Generic live matches breadcrumb
    breadcrumbs.itemListElement.push({
      "@type": "ListItem",
      "position": 2,
      "name": "Live Matches",
      "item": "https://thefinalplay.com/live"
    });
    
    breadcrumbs.itemListElement.push({
      "@type": "ListItem",
      "position": 3,
      "name": sportsEvent.name,
      "item": matchUrl
    });
  }

  // Wrap in graph structure for better SEO
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      sportsEvent,
      breadcrumbs
    ]
  };

  return `<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>`;
}

/**
 * Determine if a match is currently live
 * @param {Object} matchData - Match data
 * @returns {boolean} True if match is live
 */
function isMatchLive(matchData) {
  if (!matchData) return false;
  
  // Check match status indicators
  const status = matchData.match_status;
  if (status) {
    const liveStates = ['live', '1h', '2h', 'ht', 'et', 'bt', 'p', 'susp', 
                       'inplay_1st_half', 'inplay_2nd_half', 'inplay_half_time'];
    
    if (liveStates.includes((status.state || '').toLowerCase()) ||
        liveStates.includes((status.short_name || '').toLowerCase())) {
      return true;
    }
  }

  // Fallback: check if match has a current minute
  return matchData.minute != null && matchData.minute > 0;
}

/**
 * Determine if a match is completed
 * @param {Object} matchData - Match data  
 * @returns {boolean} True if match is completed
 */
function isMatchCompleted(matchData) {
  if (!matchData) return false;

  const status = matchData.match_status;
  if (status) {
    const completedStates = ['ft', 'aet', 'finished', 'ended', 'pen'];
    
    if (completedStates.includes((status.state || '').toLowerCase()) ||
        completedStates.includes((status.short_name || '').toLowerCase())) {
      return true;
    }
  }

  // Check if match time has passed and it's not live
  const matchStart = matchData.match_info?.starting_at ? new Date(matchData.match_info.starting_at) : null;
  if (matchStart) {
    const now = new Date();
    const hoursPassedSinceStart = (now - matchStart) / (1000 * 60 * 60);
    
    // If more than 3 hours have passed and it's not live, consider it completed
    return hoursPassedSinceStart > 3 && !isMatchLive(matchData);
  }

  return false;
}

module.exports = {
  generateMatchReportJsonLd,
  generateMinimalMatchJsonLd,
  generateLiveMatchJsonLd,
  extractMatchEventsForJsonLd,
  generateKeywords,
  isMatchLive,
  isMatchCompleted
};