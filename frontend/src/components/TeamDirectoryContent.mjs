import React from 'react';
import { toPublicTeamSlug } from '../utils/teamSlug.js';

const h = React.createElement;

export function normalizeDirectoryTeams(teams) {
  if (!Array.isArray(teams) || teams.some(team =>
    !team || typeof team.name !== 'string' || !team.name.trim() ||
    typeof team.slug !== 'string' || !team.slug.trim()
  )) {
    throw new Error('Invalid team coverage response');
  }
  return [...teams].sort((a, b) => {
    const left = a.name.toLowerCase();
    const right = b.name.toLowerCase();
    return left < right ? -1 : left > right ? 1 : a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
  });
}

export function TeamDirectoryContent({ teams }) {
  const groups = new Map();
  for (const team of teams) {
    const first = team.name.trim().charAt(0).toUpperCase();
    const letter = /^[A-Z]$/.test(first) ? first : '#';
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter).push(team);
  }

  return h('div', { className: 'team-directory' },
    h('header', { className: 'team-directory-header' },
      h('h1', null, 'Football teams'),
      h('p', null, 'Explore the teams covered by The Replay and find your team hub.')
    ),
    teams.length === 0 && h('p', null, 'No teams are currently available.'),
    [...groups].map(([letter, group]) => {
      const id = `teams-${letter === '#' ? 'other' : letter}`;
      return h('section', { className: 'team-directory-group', key: letter, 'aria-labelledby': id },
        h('h2', { id }, letter),
        h('ul', null, group.map(team =>
          h('li', { key: team.id || team.slug },
            h('a', { href: `/${toPublicTeamSlug(team.slug, team.name)}` }, team.name)
          )
        ))
      );
    })
  );
}
