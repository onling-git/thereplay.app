const normalizeTeamSlug = (value) => String(value || '').trim().toLowerCase();

const slugifyTeamName = (value) =>
  normalizeTeamSlug(value)
    .replace(/&/g, ' and ')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const legacySlugifyTeamName = (value) =>
  normalizeTeamSlug(value)
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');

const buildTeamSlugCandidates = (value) => {
  const base = normalizeTeamSlug(value);
  const candidates = new Set();
  const add = (candidate) => {
    const normalized = normalizeTeamSlug(candidate);
    if (normalized) candidates.add(normalized);
  };

  add(base);
  add(slugifyTeamName(base));
  add(legacySlugifyTeamName(base));

  if (base.includes('--')) {
    add(base.replace(/--+/g, '-and-'));
    add(base.replace(/--+/g, '-'));
    add(slugifyTeamName(base.replace(/--+/g, ' and ')));
  }

  if (base.includes('-and-')) {
    add(base.replace(/-and-/g, '--'));
    add(base.replace(/-and-/g, '-'));
  }

  const clean = slugifyTeamName(base);
  if (clean.includes('-and-')) {
    add(clean.replace(/-and-/g, '--'));
    add(clean.replace(/-and-/g, '-'));
  }

  return Array.from(candidates);
};

module.exports = {
  normalizeTeamSlug,
  slugifyTeamName,
  legacySlugifyTeamName,
  buildTeamSlugCandidates,
};
