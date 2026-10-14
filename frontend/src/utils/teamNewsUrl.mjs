export function legacyTeamNewsPath(pathname, search, hash = '') {
  if (pathname !== '/news' && pathname !== '/news/') return null;
  const params = new URLSearchParams(search);
  const teamSlug = params.get('team');
  if (!teamSlug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(teamSlug)) return null;
  params.delete('team');
  const remaining = params.toString();
  return `/${encodeURIComponent(teamSlug)}/news${remaining ? `?${remaining}` : ''}${hash}`;
}
