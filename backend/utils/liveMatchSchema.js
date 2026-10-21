const { venuePlace } = require('./venue');

const SITE_URL = 'https://thereplay.app';
const KEY_EVENTS = new Set([
  'GOAL', 'OWNGOAL', 'OWN_GOAL', 'PENALTY', 'MISSED_PENALTY',
  'YELLOWCARD', 'YELLOW_CARD', 'REDCARD', 'RED_CARD', 'YELLOWREDCARD',
  'SUBSTITUTION', 'PENALTY_SHOOTOUT_GOAL', 'PENALTY_SHOOTOUT_MISS',
]);
const FINAL_STATES = new Set(['ft', 'aet', 'ft_pen', 'finished', 'ended', 'after_penalties', 'full_time']);

function statusCode(match) {
  const status = match.match_status;
  return String(status?.developer_name || status?.short_name || status?.state || status?.name || status || '')
    .trim().toLowerCase().replace(/[ -]+/g, '_');
}

function isFinalMatch(match) {
  return FINAL_STATES.has(statusCode(match));
}

function isoDate(value) {
  if (value == null || value === '') return undefined;
  const date = typeof value === 'number' ? new Date(value * 1000) : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid match schema timestamp: ${value}`);
  return date.toISOString();
}

function matchPageUrl(match) {
  const homeSlug = match.teams?.home?.supported === false
    ? match.teams?.away?.team_slug : match.teams?.home?.team_slug;
  if (!homeSlug || !match.match_id) throw new Error('Canonical match schema requires a home team slug and fixture ID');
  return `${SITE_URL}/${encodeURIComponent(homeSlug)}/match/${encodeURIComponent(match.match_id)}`;
}

function buildLiveMatchGraph(match, venue = match.match_info?.venue) {
  const url = matchPageUrl(match);
  const home = match.teams?.home;
  const away = match.teams?.away;
  if (!home?.team_name || !away?.team_name) throw new Error('Match schema requires both team names');
  const name = `${home.team_name} vs ${away.team_name}`;
  const status = statusCode(match);
  const eventStatus = {
    ns: 'EventScheduled', not_started: 'EventScheduled', scheduled: 'EventScheduled', upcoming: 'EventScheduled',
    postp: 'EventPostponed', postponed: 'EventPostponed',
    canc: 'EventCancelled', cancelled: 'EventCancelled', canceled: 'EventCancelled',
  }[status];
  const startDate = isoDate(match.match_info?.starting_at || match.date);
  const teamNode = (team) => ({
    '@type': 'SportsTeam',
    ...(team.team_slug && team.supported !== false ? { '@id': `${SITE_URL}/${encodeURIComponent(team.team_slug)}/` } : {}),
    name: team.team_name,
  });
  const location = venuePlace(venue);
  const graph = [
    {
      '@type': 'WebPage', '@id': `${url}#webpage`, url,
      isPartOf: { '@id': `${SITE_URL}/#website`, '@type': 'WebSite', name: 'The Replay', url: SITE_URL },
      about: { '@id': `${url}#event` },
    },
    {
      '@type': 'SportsEvent', '@id': `${url}#event`, url, name,
      ...(startDate ? { startDate } : {}),
      ...(eventStatus ? { eventStatus: `https://schema.org/${eventStatus}` } : {}),
      sport: 'Football',
      homeTeam: teamNode(home), awayTeam: teamNode(away),
      ...(location ? { location } : {}),
    },
  ];

  const seen = new Set();
  const updates = (match.events || [])
    .filter((event) => !event.rescinded && KEY_EVENTS.has(String(event.type || '').toUpperCase()))
    .filter((event) => {
      const key = event.id ?? `${event.type}|${event.minute}|${event.extra_minute}|${event.player_id || event.player_name}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.sort_order ?? a.minute ?? 0) - (b.sort_order ?? b.minute ?? 0))
    .slice(-40)
    .map((event) => {
      const minute = event.minute != null ? `${event.minute}${event.extra_minute ? `+${event.extra_minute}` : ''}'` : '';
      const player = event.player_name || event.player;
      const detailedPeriod = (match.detailed_periods || []).find((entry) => entry.id === event.detailed_period_id);
      const period = detailedPeriod || (match.periods || []).find((entry) => entry.id === event.period_id);
      // Match minutes are not wall-clock times: use the actual period start to account for halftime.
      const timed = period?.started && period.counts_from != null && event.minute != null
        && event.minute >= period.counts_from
        && (detailedPeriod || period.type_id !== 3 || event.minute < 105);
      const published = event.published_at
        ? isoDate(event.published_at)
        : timed ? isoDate(period.started + (event.minute + (event.extra_minute || 0) - period.counts_from) * 60) : undefined;
      const eventKey = event.id ?? `${event.type}-${event.minute}-${event.extra_minute || 0}-${event.player_id || player || ''}`;
      return {
        '@type': 'BlogPosting',
        '@id': `${url}#update-${encodeURIComponent(eventKey)}`,
        headline: [String(event.type).replace(/_/g, ' '), player, minute].filter(Boolean).join(' - '),
        ...(published ? { datePublished: published } : {}),
        ...(event.info ? { articleBody: event.info } : {}),
      };
    });

  const coverageStart = (match.periods || []).filter((period) => period.started)
    .sort((a, b) => a.started - b.started)[0]?.started;
  const live = ['live', '1h', '2h', 'ht', 'et', 'inplay_1st_half', 'inplay_2nd_half', 'inplay_half_time', 'extra_time', 'penalties'].includes(status);
  if (updates.length || live || isFinalMatch(match)) {
    const ended = isFinalMatch(match)
      ? Math.max(0, ...(match.periods || []).map((period) => period.ended || 0))
      : 0;
    graph.push({
      '@type': 'LiveBlogPosting', '@id': `${url}#liveblog`,
      headline: `${name} - ${isFinalMatch(match) ? 'Match updates' : 'LIVE'}`,
      about: { '@id': `${url}#event` },
      mainEntityOfPage: url,
      ...(coverageStart ? { coverageStartTime: isoDate(coverageStart) } : {}),
      ...(ended ? { coverageEndTime: isoDate(ended) } : {}),
      liveBlogUpdate: updates,
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

function schemaScript(graph) {
  return `<script id="live-match-structured-data" type="application/ld+json">${JSON.stringify(graph).replace(/</g, '\\u003c')}</script>`;
}

module.exports = { buildLiveMatchGraph, matchPageUrl, isFinalMatch, schemaScript };
