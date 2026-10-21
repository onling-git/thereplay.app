export const slugifyTeamName = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const toPublicTeamSlug = (teamSlug, teamName = '') => {
  if (!teamSlug) return slugifyTeamName(teamName);
  const slugSource = String(teamSlug).replace(/--+/g, teamName && !teamName.includes('&') ? '-' : '-and-');
  return slugifyTeamName(slugSource);
};

export const samePublicTeamSlug = (leftSlug, rightSlug, leftName = '', rightName = '') =>
  toPublicTeamSlug(leftSlug, leftName) === toPublicTeamSlug(rightSlug, rightName);
