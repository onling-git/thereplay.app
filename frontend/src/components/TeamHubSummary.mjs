import React from 'react';
import { toPublicTeamSlug } from '../utils/teamSlug.js';

const h = React.createElement;

export function projectTeamHubData(team, fixtures) {
  if (!team || typeof team.name !== 'string' || !team.name.trim() ||
      typeof team.slug !== 'string' || !team.slug.trim() ||
      !fixtures || !Array.isArray(fixtures.recent) || !Array.isArray(fixtures.upcoming)) {
    throw new Error('Invalid team hub response');
  }
  const projectFixture = match => {
    const id = Number(match?.match_id);
    const home = match?.teams?.home?.team_name;
    const away = match?.teams?.away?.team_name;
    const date = match?.match_info?.starting_at || match?.date;
    if (!Number.isSafeInteger(id) || id <= 0 || typeof home !== 'string' || !home.trim() ||
        typeof away !== 'string' || !away.trim() ||
        !date || !Number.isFinite(Date.parse(date))) {
      throw new Error('Invalid team fixture in team hub response');
    }
    return {
      id, home, away, date: new Date(date).toISOString(),
      homeSlug: toPublicTeamSlug(match.teams.home.team_slug, home),
      score: match.score && Number.isFinite(match.score.home) && Number.isFinite(match.score.away)
        ? { home: match.score.home, away: match.score.away } : null,
    };
  };
  return {
    team: {
      name: team.name,
      slug: team.slug,
      story: typeof team.story?.content === 'string' ? team.story.content : '',
      venue: typeof team.venue === 'string' ? team.venue :
        (typeof team.venue?.name === 'string' ? team.venue.name : ''),
    },
    recent: fixtures.recent.map(projectFixture),
    upcoming: fixtures.upcoming.map(projectFixture),
  };
}

export function TeamHubSummary({ data, slug }) {
  const fixtureList = (label, matches, showScore) => h('section', { className: 'team-hub-summary-fixtures' },
    h('h3', null, label),
    matches.length === 0 ? h('p', null, `No ${label.toLowerCase()} available.`) :
      h('ul', null, matches.map(match => h('li', { key: match.id },
        h('a', { href: `/${encodeURIComponent(match.homeSlug || slug)}/match/${match.id}` },
          `${match.home} ${showScore && match.score ? `${match.score.home}–${match.score.away}` : 'v'} ${match.away}`),
        ' — ', h('time', { dateTime: match.date }, match.date.slice(0, 10))
      )))
  );
  return h('section', { className: 'team-hub-summary', 'aria-label': `${data.team.name} overview` },
    h('h2', null, `${data.team.name} overview`),
    data.team.venue && h('p', null, `Home ground: ${data.team.venue}`),
    data.team.story && h('div', { className: 'team-story-section' },
      data.team.story.split(/\n\s*\n/).map((paragraph, index) => h('p', { key: index }, paragraph))),
    fixtureList('Recent matches', data.recent, true),
    fixtureList('Upcoming matches', data.upcoming, false),
    h('p', null,
      h('a', { href: `/${encodeURIComponent(slug)}/news` }, `${data.team.name} news`),
      ' · ', h('a', { href: '/teams' }, 'All teams'),
      ' · ', h('a', { href: '/fixtures' }, 'All fixtures'))
  );
}
