const Report = require('../models/Report');
const Match = require('../models/Match');

/**
 * Generate RSS feed for match reports
 * @param {Object} options - Options for RSS generation
 * @param {string} options.baseUrl - Base URL for the application
 * @param {string} [options.teamSlug] - Filter reports by team slug
 * @param {string} [options.league] - Filter reports by league
 * @param {number} [options.limit=20] - Maximum number of reports to include
 * @param {Date} [options.since] - Only include reports since this date
 * @returns {string} RSS XML content
 */
async function generateMatchReportsRss(options = {}) {
  const {
    baseUrl,
    teamSlug,
    league,
    limit = 20,
    since
  } = options;

  try {
    // Build query for reports
    let reportQuery = {};
    let matchQuery = {};

    // Filter by team if specified
    if (teamSlug) {
      reportQuery.team_slug = teamSlug;
    }

    // Filter by date if specified
    if (since) {
      reportQuery.createdAt = { $gte: since };
    }

    // Get reports with match data
    const reports = await Report.aggregate([
      { $match: reportQuery },
      {
        $lookup: {
          from: 'matches',
          localField: 'match_id',
          foreignField: 'match_id',
          as: 'match'
        }
      },
      { $unwind: '$match' },
      ...(league ? [{ $match: { 'match.match_info.league.name': league } }] : []),
      { $sort: { createdAt: -1 } },
      { $limit: limit }
    ]);

    // Generate RSS XML
    const feedTitle = buildFeedTitle(teamSlug, league);
    const feedDescription = buildFeedDescription(teamSlug, league);
    const feedLink = `${baseUrl}/api/reports/rss${teamSlug ? `/${teamSlug}` : ''}`;

    const items = reports.map(report => generateRssItem(report, baseUrl));
    const itemsXml = items.join('\n');

    const buildDate = new Date().toUTCString();
    const lastBuildDate = reports.length > 0 ? new Date(reports[0].createdAt).toUTCString() : buildDate;

    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:content="http://purl.org/rss/1.0/modules/content/">
<channel>
  <title>${escapeXml(feedTitle)}</title>
  <link>${escapeXml(feedLink)}</link>
  <description>${escapeXml(feedDescription)}</description>
  <language>en-us</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
  <pubDate>${buildDate}</pubDate>
  <ttl>60</ttl>
  <generator>The Final Play RSS Generator</generator>
  <atom:link href="${escapeXml(feedLink)}" rel="self" type="application/rss+xml" />
  <image>
    <url>${baseUrl}/favicon.ico</url>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(feedLink)}</link>
  </image>
${itemsXml}
</channel>
</rss>`;

    return rss;
  } catch (error) {
    console.error('[RSS] Error generating match reports RSS:', error);
    throw error;
  }
}

/**
 * Generate RSS item for a single report
 */
function generateRssItem(report, baseUrl) {
  const match = report.match;
  const homeTeam = match.teams?.home?.team_name || 'Unknown';
  const awayTeam = match.teams?.away?.team_name || 'Unknown';
  const score = `${match.score?.home || 0}-${match.score?.away || 0}`;
  
  const title = report.generated?.headline || report.headline || 
                `${report.team_focus} Match Report: ${homeTeam} vs ${awayTeam} (${score})`;
  
  const description = buildItemDescription(report, match);
  const link = `${baseUrl}/${report.team_slug}/match/${report.match_id}/report`;
  const guid = `report-${report._id}`;
  const pubDate = new Date(report.createdAt).toUTCString();
  const matchDate = new Date(match.date).toLocaleDateString();
  const league = match.match_info?.league?.name || 'Unknown League';

  // Categories for the report
  const categories = [
    escapeXml(league),
    escapeXml(report.team_focus || 'Football'),
    'Match Report',
    'Post Match Analysis'
  ];

  const categoryXml = categories.map(cat => `    <category>${cat}</category>`).join('\n');

  return `  <item>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <guid isPermaLink="false">${escapeXml(guid)}</guid>
    <pubDate>${pubDate}</pubDate>
    <description>${escapeXml(description)}</description>
    <content:encoded><![CDATA[${generateRichContent(report, match)}]]></content:encoded>
${categoryXml}
    <author>reports@thefinalplay.com (The Final Play)</author>
  </item>`;
}

/**
 * Build item description for RSS
 */
function buildItemDescription(report, match) {
  const homeTeam = match.teams?.home?.team_name || 'Unknown';
  const awayTeam = match.teams?.away?.team_name || 'Unknown';
  const score = `${match.score?.home || 0}-${match.score?.away || 0}`;
  const league = match.match_info?.league?.name || 'Unknown League';
  const matchDate = new Date(match.date).toLocaleDateString();
  
  let description = `Post-match analysis for ${report.team_focus} following their ${league} fixture against `;
  description += report.team_focus === homeTeam ? `${awayTeam}` : `${homeTeam}`;
  description += ` on ${matchDate}. Final score: ${homeTeam} ${score} ${awayTeam}.`;
  
  // Add summary if available
  if (report.generated?.summary_paragraphs?.length > 0) {
    description += ` ${report.generated.summary_paragraphs[0].substring(0, 200)}...`;
  } else if (report.summary_paragraphs?.length > 0) {
    description += ` ${report.summary_paragraphs[0].substring(0, 200)}...`;
  }
  
  return description;
}

/**
 * Generate rich content for RSS item
 */
function generateRichContent(report, match) {
  const homeTeam = match.teams?.home?.team_name || 'Unknown';
  const awayTeam = match.teams?.away?.team_name || 'Unknown';
  const score = `${match.score?.home || 0}-${match.score?.away || 0}`;
  const league = match.match_info?.league?.name || 'Unknown League';
  const matchDate = new Date(match.date).toLocaleDateString();
  
  let content = `<div class="match-report">`;
  content += `<h2>${report.generated?.headline || report.headline || 'Match Report'}</h2>`;
  content += `<div class="match-info">`;
  content += `<p><strong>Match:</strong> ${homeTeam} ${score} ${awayTeam}</p>`;
  content += `<p><strong>Competition:</strong> ${league}</p>`;
  content += `<p><strong>Date:</strong> ${matchDate}</p>`;
  content += `<p><strong>Focus Team:</strong> ${report.team_focus}</p>`;
  content += `</div>`;

  // Add summary paragraphs
  const summaryParagraphs = report.generated?.summary_paragraphs || report.summary_paragraphs || [];
  if (summaryParagraphs.length > 0) {
    content += `<div class="summary">`;
    summaryParagraphs.forEach(paragraph => {
      content += `<p>${paragraph}</p>`;
    });
    content += `</div>`;
  }

  // Add key moments
  const keyMoments = report.generated?.key_moments || report.key_moments || [];
  if (keyMoments.length > 0) {
    content += `<div class="key-moments">`;
    content += `<h3>Key Moments</h3>`;
    content += `<ul>`;
    keyMoments.forEach(moment => {
      content += `<li>${moment}</li>`;
    });
    content += `</ul>`;
    content += `</div>`;
  }

  // Add Player of the Match
  const potm = report.generated?.player_of_the_match || report.potm;
  if (potm && potm.player) {
    content += `<div class="player-of-match">`;
    content += `<h3>Player of the Match</h3>`;
    content += `<p><strong>${potm.player}</strong></p>`;
    if (potm.reason) {
      content += `<p>${potm.reason}</p>`;
    }
    content += `</div>`;
  }

  content += `</div>`;
  return content;
}

/**
 * Build feed title based on filters
 */
function buildFeedTitle(teamSlug, league) {
  let title = 'The Final Play - Match Reports';
  
  if (teamSlug && league) {
    title = `The Final Play - ${teamSlug.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Reports (${league})`;
  } else if (teamSlug) {
    title = `The Final Play - ${teamSlug.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())} Match Reports`;
  } else if (league) {
    title = `The Final Play - ${league} Match Reports`;
  }
  
  return title;
}

/**
 * Build feed description based on filters
 */
function buildFeedDescription(teamSlug, league) {
  let description = 'Latest post-match analysis and reports from The Final Play';
  
  if (teamSlug && league) {
    const teamName = teamSlug.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    description = `Post-match analysis and reports for ${teamName} in the ${league} from The Final Play`;
  } else if (teamSlug) {
    const teamName = teamSlug.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
    description = `All post-match analysis and reports for ${teamName} from The Final Play`;
  } else if (league) {
    description = `Post-match analysis and reports for ${league} matches from The Final Play`;
  }
  
  return description;
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Get available RSS feeds (for discovery)
 */
async function getAvailableRssFeeds(baseUrl) {
  try {
    // Get unique team slugs with reports
    const teamFeeds = await Report.aggregate([
      { $group: { _id: '$team_slug', count: { $sum: 1 }, lastReport: { $max: '$createdAt' } } },
      { $match: { _id: { $ne: null } } },
      { $sort: { count: -1 } }
    ]);

    // Get unique leagues with reports
    const leagueFeeds = await Report.aggregate([
      {
        $lookup: {
          from: 'matches',
          localField: 'match_id',
          foreignField: 'match_id',
          as: 'match'
        }
      },
      { $unwind: '$match' },
      {
        $group: {
          _id: '$match.match_info.league.name',
          count: { $sum: 1 },
          lastReport: { $max: '$createdAt' }
        }
      },
      { $match: { _id: { $ne: null } } },
      { $sort: { count: -1 } }
    ]);

    const feeds = [
      {
        id: 'all-reports',
        title: 'All Match Reports',
        description: 'Latest post-match analysis from all teams and leagues',
        url: `${baseUrl}/api/reports/rss`,
        type: 'all'
      }
    ];

    // Add team-specific feeds
    teamFeeds.forEach(team => {
      if (team._id) {
        const teamName = team._id.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());
        feeds.push({
          id: `team-${team._id}`,
          title: `${teamName} Match Reports`,
          description: `Post-match analysis for ${teamName}`,
          url: `${baseUrl}/api/reports/rss/${team._id}`,
          type: 'team',
          teamSlug: team._id,
          reportCount: team.count,
          lastReport: team.lastReport
        });
      }
    });

    // Add league-specific feeds
    leagueFeeds.forEach(league => {
      if (league._id) {
        feeds.push({
          id: `league-${league._id.toLowerCase().replace(/\s+/g, '-')}`,
          title: `${league._id} Match Reports`,
          description: `Post-match analysis for ${league._id} matches`,
          url: `${baseUrl}/api/reports/rss/league/${encodeURIComponent(league._id)}`,
          type: 'league',
          league: league._id,
          reportCount: league.count,
          lastReport: league.lastReport
        });
      }
    });

    return feeds;
  } catch (error) {
    console.error('[RSS] Error getting available RSS feeds:', error);
    return [];
  }
}

module.exports = {
  generateMatchReportsRss,
  getAvailableRssFeeds,
  escapeXml
};