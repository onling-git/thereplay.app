const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildLiveMatchGraph, matchPageUrl, schemaScript, isFinalMatch } = require('./utils/liveMatchSchema');
const { normaliseFixtureToMatchDoc } = require('./utils/normaliseFixture');
const { normalizeVenue, registerVenue } = require('./utils/venue');
const Venue = require('./models/Venue');
const Match = require('./models/Match');
const { refreshLiveMatchStructuredData } = require('./services/liveMatchStructuredData');

const fixture = {
  _id: '507f1f77bcf86cd799439011',
  updatedAt: new Date('2026-10-17T19:00:00Z'),
  match_id: 19729063,
  teams: {
    home: { team_slug: 'southampton', team_name: 'Southampton' },
    away: { team_slug: 'portsmouth', team_name: 'Portsmouth' },
  },
  match_info: {
    starting_at: '2026-10-17T20:00:00+01:00',
    venue: {
      id: 65, slug: 'st-marys-stadium-65', name: "St Mary's Stadium",
      address: 'Britannia Road', city_name: 'Southampton', country_code: 'GB',
    },
  },
  match_status: { developer_name: 'NS' },
  periods: [
    { id: 1, started: Date.parse('2026-10-17T19:00:00Z') / 1000, counts_from: 0, ended: Date.parse('2026-10-17T19:48:00Z') / 1000 },
    { id: 2, started: Date.parse('2026-10-17T20:03:00Z') / 1000, counts_from: 45, ended: Date.parse('2026-10-17T20:52:00Z') / 1000 },
  ],
  events: [],
};
const nodeOf = (graph, type) => graph['@graph'].find((node) => node['@type'] === type);

test('the match page owns a production canonical event and stable venue identity', () => {
  const graph = buildLiveMatchGraph(fixture);
  assert.equal(matchPageUrl(fixture), 'https://thereplay.app/southampton/match/19729063');
  const event = nodeOf(graph, 'SportsEvent');
  assert.equal(event['@id'], 'https://thereplay.app/southampton/match/19729063#event');
  assert.equal(nodeOf(graph, 'WebPage').about['@id'], event['@id']);
  assert.equal(event.startDate, '2026-10-17T19:00:00.000Z');
  assert.equal(event.eventStatus, 'https://schema.org/EventScheduled');
  assert.equal(event.homeTeam['@id'], 'https://thereplay.app/southampton/');
  assert.equal(event.awayTeam['@id'], 'https://thereplay.app/portsmouth/');
  assert.deepEqual(event.location, {
    '@type': 'Place', '@id': 'https://thereplay.app/venues/st-marys-stadium-65#place',
    name: "St Mary's Stadium",
    address: { '@type': 'PostalAddress', streetAddress: 'Britannia Road', addressLocality: 'Southampton', addressCountry: 'GB' },
  });
  assert.equal(nodeOf(graph, 'LiveBlogPosting'), undefined);
});

test('phase changes keep the canonical ID and never output invalid status enumerations', () => {
  for (const [state, expected] of [
    ['POSTP', 'EventPostponed'], ['CANC', 'EventCancelled'],
    ['INPLAY_1ST_HALF', undefined], ['FT', undefined], ['AET', undefined], ['FT_PEN', undefined],
  ]) {
    const graph = buildLiveMatchGraph({ ...fixture, match_status: { developer_name: state } });
    const event = nodeOf(graph, 'SportsEvent');
    assert.equal(event['@id'], 'https://thereplay.app/southampton/match/19729063#event');
    assert.equal(event.eventStatus, expected && `https://schema.org/${expected}`);
  }
  assert.equal(isFinalMatch({ ...fixture, match_status: { developer_name: 'PENALTIES' } }), false);
});

test('key updates grow without commentary and account for halftime and added time', () => {
  const graph = buildLiveMatchGraph({
    ...fixture,
    match_status: { developer_name: 'INPLAY_2ND_HALF' },
    comments: [{ comment: 'every commentary line' }],
    events: [
      { id: 3, type: 'SUBSTITUTION', period_id: 2, minute: 60, player_name: 'Player', sort_order: 3 },
      { id: 1, type: 'GOAL', period_id: 1, minute: 23, player_name: 'Bree', sort_order: 1 },
      { id: 2, type: 'YELLOWCARD', period_id: 1, minute: 45, extra_minute: 2, player_name: 'Player', sort_order: 2 },
      { id: 1, type: 'GOAL', period_id: 1, minute: 23, player_name: 'Bree', sort_order: 1 },
      { id: 4, type: 'GOAL', minute: 30, rescinded: true },
      { id: 5, type: 'CORNER', minute: 31 },
    ],
  });
  const blog = nodeOf(graph, 'LiveBlogPosting');
  assert.equal(blog.coverageStartTime, '2026-10-17T19:00:00.000Z');
  assert.equal(blog.liveBlogUpdate.length, 3);
  assert.equal(blog.liveBlogUpdate[0].headline, "GOAL - Bree - 23'");
  assert.equal(blog.liveBlogUpdate[0].datePublished, '2026-10-17T19:23:00.000Z');
  assert.equal(blog.liveBlogUpdate[1].datePublished, '2026-10-17T19:47:00.000Z');
  assert.equal(blog.liveBlogUpdate[2].datePublished, '2026-10-17T20:18:00.000Z');
});

test('the final blog has actual coverage end and bounded updates including the latest events', () => {
  const graph = buildLiveMatchGraph({
    ...fixture, match_status: { short_name: 'FT' },
    events: Array.from({ length: 45 }, (_, index) => ({
      id: index + 1, type: 'YELLOWCARD', sort_order: index + 1, minute: index + 1, period_id: 1,
    })),
  });
  const blog = nodeOf(graph, 'LiveBlogPosting');
  assert.equal(blog.coverageEndTime, '2026-10-17T20:52:00.000Z');
  assert.equal(blog.liveBlogUpdate.length, 40);
  assert.match(blog.liveBlogUpdate[39]['@id'], /update-45$/);
  assert.equal(nodeOf(graph, 'SportsEvent').eventStatus, undefined);
});

test('missing timing and location data is not invented', () => {
  const graph = buildLiveMatchGraph({
    ...fixture, match_info: {}, periods: [],
    events: [{ id: 1, type: 'GOAL', minute: 60, player_name: 'Bree' }],
  });
  assert.equal(nodeOf(graph, 'SportsEvent').startDate, undefined);
  assert.equal(nodeOf(graph, 'SportsEvent').location, undefined);
  const blog = nodeOf(graph, 'LiveBlogPosting');
  assert.equal(blog.coverageStartTime, undefined);
  assert.equal(blog.liveBlogUpdate[0].datePublished, undefined);
  assert.throws(() => buildLiveMatchGraph({ ...fixture, match_info: { starting_at: 'bad-date' } }), /Invalid match schema timestamp/);
});

test('script serialization escapes stored text without changing its JSON value', () => {
  const graph = buildLiveMatchGraph({
    ...fixture, teams: { ...fixture.teams, home: { ...fixture.teams.home, team_name: '</script><script>alert(1)</script>' } },
  });
  const script = schemaScript(graph);
  const json = script.slice(script.indexOf('>') + 1, script.lastIndexOf('</script>'));
  assert.equal(json.includes('<'), false);
  assert.deepEqual(JSON.parse(json), graph);
});

test('normalization persists venue details and full period clocks', () => {
  const normalized = normaliseFixtureToMatchDoc({
    id: 19729063, starting_at_timestamp: Date.parse('2026-10-17T19:00:00Z') / 1000,
    venue: { id: 65, name: "St Mary's Stadium", address: 'Britannia Road', city: { name: 'Southampton', country: { iso2: 'GB' } } },
    periods: fixture.periods, events: [{ id: 1, minute: 23, type_id: 14, period_id: 1 }],
  });
  assert.equal(normalized.match_info.venue.name, "St Mary's Stadium");
  assert.equal(normalized.match_info.venue.country_code, 'GB');
  assert.deepEqual(normalized.periods, fixture.periods);
  const model = new Match(normalized);
  assert.equal(model.toObject().periods.length, 2);
  assert.equal(model.toObject().events[0].period_id, 1);
});

test('venue IDs keep their original slug when the provider renames a stadium', async (t) => {
  let saved;
  t.mock.method(Venue, 'findOneAndUpdate', (filter, update) => ({
    lean: async () => {
      assert.equal(filter.id, 65);
      saved = { ...saved, ...update.$set, slug: saved?.slug || update.$setOnInsert.slug };
      return saved;
    },
  }));
  const original = await registerVenue({ id: 65, name: "St Mary's Stadium" });
  const renamed = await registerVenue({ id: 65, name: 'Renamed stadium' });
  assert.equal(original.slug, renamed.slug);
  assert.equal(renamed.name, 'Renamed stadium');
  assert.equal(normalizeVenue({ name: 'No provider ID' }), null);
});

test('live snapshots regenerate on status changes; the final graph is persisted and immutable', async (t) => {
  const match = { ...fixture, match_info: { starting_at: fixture.match_info.starting_at }, structured_data_frozen_at: null };
  const writes = [];
  t.mock.method(Match, 'updateOne', async (filter, update, options) => {
    writes.push({ filter, update, options });
    return { matchedCount: 1 };
  });
  const first = await refreshLiveMatchStructuredData(match);
  const postponed = await refreshLiveMatchStructuredData({ ...match, match_status: { short_name: 'POSTP' } });
  assert.equal(nodeOf(first, 'SportsEvent').eventStatus, 'https://schema.org/EventScheduled');
  assert.equal(nodeOf(postponed, 'SportsEvent').eventStatus, 'https://schema.org/EventPostponed');
  const final = await refreshLiveMatchStructuredData({ ...match, match_status: { short_name: 'FT' } });
  assert.ok(writes[2].update.$set.structured_data_frozen_at instanceof Date);
  assert.equal(writes[2].options.timestamps, false);
  const frozen = await refreshLiveMatchStructuredData({
    ...match, structured_data: final, structured_data_frozen_at: new Date(),
    events: [{ type: 'GOAL', minute: 1 }],
  });
  assert.deepEqual(frozen, final);
  assert.equal(writes.length, 3);
});

test('both report perspectives fetch the same canonical server schema', async (t) => {
  const Team = require('./models/Team');
  const { getMatchSchema } = require('./controllers/matchController');
  const graph = buildLiveMatchGraph(fixture);
  const frozen = { ...fixture, structured_data: graph, structured_data_frozen_at: new Date() };
  t.mock.method(Team, 'findOne', ({ slug }) => ({
    lean: async () => ({ name: slug === 'southampton' ? 'Southampton' : 'Portsmouth' }),
  }));
  t.mock.method(Match, 'findOne', () => ({ lean: async () => frozen }));
  const responses = [];
  for (const teamName of ['southampton', 'portsmouth']) {
    const res = {
      set: (key, value) => { assert.equal(key, 'Cache-Control'); assert.equal(value, 'no-store'); },
      json: (body) => responses.push(body),
      status: () => { throw new Error('Unexpected controller failure'); },
    };
    await getMatchSchema({ params: { teamName, matchId: '19729063' } }, res);
  }
  assert.equal(responses[0].matchUrl, responses[1].matchUrl);
  assert.deepEqual(responses[0].graph, responses[1].graph);
  assert.ok(responses[0].schema.includes('application/ld+json'));
});

test('team home venue is fetched from Sportmonks then cached, not inferred from fixtures', async (t) => {
  const Team = require('./models/Team');
  const sportmonks = require('./utils/sportmonks');
  let written;
  let calls = 0;
  t.mock.method(sportmonks, 'get', async (path) => {
    calls += 1;
    assert.equal(path, '/teams/65');
    return { data: { data: { venue_id: 65, venue: { id: 65, name: "St Mary's Stadium" } } } };
  });
  // Reload after mocking the destructured provider helper.
  delete require.cache[require.resolve('./services/teamVenue')];
  const { getTeamHomeVenue } = require('./services/teamVenue');
  t.mock.method(Venue, 'findOneAndUpdate', (filter, update) => ({
    lean: async () => ({ ...update.$set, slug: update.$setOnInsert.slug }),
  }));
  t.mock.method(Team, 'updateOne', async (filter, update) => {
    written = update.$set;
    return { matchedCount: 1 };
  });
  const team = { _id: fixture._id, id: 65 };
  const venue = await getTeamHomeVenue(team);
  assert.equal(venue.name, "St Mary's Stadium");
  assert.equal(written.venue_id, 65);
  const cached = await getTeamHomeVenue({ ...team, ...written });
  assert.equal(cached.slug, venue.slug);
  assert.equal(calls, 1);
  delete require.cache[require.resolve('./services/teamVenue')];
});

test('an obsolete live request cannot overwrite a concurrently frozen final snapshot', async (t) => {
  const final = buildLiveMatchGraph({ ...fixture, match_status: { short_name: 'FT' } });
  const snapshot = { ...fixture, match_info: { starting_at: fixture.match_info.starting_at } };
  t.mock.method(Match, 'updateOne', async () => ({ matchedCount: 0 }));
  t.mock.method(Match, 'findById', () => ({
    lean: async () => ({ ...snapshot, structured_data: final, structured_data_frozen_at: new Date() }),
  }));
  assert.deepEqual(await refreshLiveMatchStructuredData(snapshot), final);
});

test('second-half extra time uses the detailed period start instead of ignoring the interval', () => {
  const event = { id: 1, type: 'GOAL', minute: 110, period_id: 3, detailed_period_id: 4 };
  const extraTime = {
    ...fixture, match_status: { short_name: 'ET' },
    periods: [{ id: 3, type_id: 3, started: Date.parse('2026-10-17T21:00:00Z') / 1000, counts_from: 90 }],
    detailed_periods: [{ id: 4, started: Date.parse('2026-10-17T21:20:00Z') / 1000, counts_from: 105 }],
    events: [event],
  };
  const graph = buildLiveMatchGraph(extraTime);
  assert.equal(nodeOf(graph, 'LiveBlogPosting').liveBlogUpdate[0].datePublished, '2026-10-17T21:25:00.000Z');
  const missingDetail = buildLiveMatchGraph({ ...extraTime, detailed_periods: [] });
  assert.equal(nodeOf(missingDetail, 'LiveBlogPosting').liveBlogUpdate[0].datePublished, undefined);
});

test('fixture normalization rejects invented kickoffs and retains valid UTC fallbacks', () => {
  assert.throws(() => normaliseFixtureToMatchDoc({ id: 1 }), /missing a valid kickoff/);
  assert.throws(() => normaliseFixtureToMatchDoc({ id: 1, starting_at_timestamp: null }), /missing a valid kickoff/);
  const normal = normaliseFixtureToMatchDoc({ id: 1, starting_at_timestamp: null, starting_at: '2026-10-17 19:00:00' });
  assert.equal(normal.match_info.starting_at.toISOString(), '2026-10-17T19:00:00.000Z');
});
