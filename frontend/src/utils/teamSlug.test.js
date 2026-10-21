import { samePublicTeamSlug, slugifyTeamName, toPublicTeamSlug } from './teamSlug';

describe('teamSlug', () => {
  test('converts ampersand names to and without duplicate separators', () => {
    expect(slugifyTeamName('Brighton & Hove Albion')).toBe('brighton-and-hove-albion');
    expect(slugifyTeamName(' Queens Park  Rangers ')).toBe('queens-park-rangers');
  });

  test('builds public slugs from legacy stored slugs when no name is available', () => {
    expect(toPublicTeamSlug('brighton--hove-albion')).toBe('brighton-and-hove-albion');
  });

  test('preserves custom stored identifiers even when a display name is supplied', () => {
    expect(toPublicTeamSlug('custom-club-id', 'Brighton & Hove Albion')).toBe('custom-club-id');
    expect(toPublicTeamSlug('queens--park-rangers', 'Queens  Park Rangers')).toBe('queens-park-rangers');
  });

  test('treats legacy and public slugs as the same team when a name is known', () => {
    expect(
      samePublicTeamSlug('brighton--hove-albion', 'brighton-and-hove-albion', 'Brighton & Hove Albion')
    ).toBe(true);
  });
});
