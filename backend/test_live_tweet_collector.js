const assert = require('node:assert/strict');
const { test, afterEach, mock } = require('node:test');
const Team = require('./models/Team');
const Tweet = require('./models/Tweet');
const twitter = require('./utils/twitterService');
const coverage = require('./services/coveragePolicy');
const { collectTweetsForLiveMatches } = require('./services/liveTweetCollector');

afterEach(() => mock.restoreAll());

test('live reporter collection uses the match window without requiring a hashtag', async () => {
  const kickoff = new Date(Date.now() - 60 * 60 * 1000);
  const beforeKickoff = new Date(kickoff.getTime() - 1000);
  const duringMatch = new Date(kickoff.getTime() + 1000);
  const future = new Date(Date.now() + 60 * 1000);
  mock.method(coverage, 'getCoverage', async () => ({ teamIds: [1] }));
  mock.method(Team, 'findOne', () => ({
    lean: async () => ({
      id: 1, slug: 'home', name: 'Home',
      twitter: { hashtag: '#HOME', reporters: [{ handle: '@reporter' }] }
    })
  }));
  mock.method(Tweet, 'findOne', async () => null);
  const save = mock.method(Tweet, 'create', async tweet => tweet);
  const search = mock.method(twitter, 'searchByUser', async () => ({
    tweets: [
      ...Array.from({ length: 25 }, (_, i) => ({ id: `early-${i}`, createdAt: beforeKickoff })),
      { id: 'during', text: 'Match update without a hashtag', createdAt: duringMatch, author: { id: '1' } },
      { id: 'future', createdAt: future }
    ]
  }));

  await collectTweetsForLiveMatches([{
    match_id: 987654, date: kickoff,
    teams: { home: { team_id: 1 }, away: { team_id: 2 } }
  }]);

  assert.deepEqual(search.mock.calls[0].arguments[0], ['@reporter']);
  const options = search.mock.calls[0].arguments[1];
  assert.equal(options.hashtag, undefined);
  assert.equal(options.since.getTime(), kickoff.getTime());
  assert.equal(save.mock.callCount(), 1);
  assert.equal(save.mock.calls[0].arguments[0].tweet_id, 'during');
});

test('a tweet already stored for the fan feed is also associated with the match report', async () => {
  const kickoff = new Date(Date.now() - 60 * 60 * 1000);
  mock.method(coverage, 'getCoverage', async () => ({ teamIds: [1] }));
  mock.method(Team, 'findOne', () => ({
    lean: async () => ({ id: 1, slug: 'home', name: 'Home', twitter: { reporters: [{ handle: '@reporter' }] } })
  }));
  mock.method(twitter, 'searchByUser', async () => ({
    tweets: [{ id: 'existing', text: 'Match update', createdAt: new Date(), author: { id: '1' } }]
  }));
  mock.method(Tweet, 'findOne', async () => ({ tweet_id: 'existing', collection_context: { collected_for: 'team_feed' } }));
  const update = mock.method(Tweet, 'updateOne', async () => ({ matchedCount: 1 }));
  const create = mock.method(Tweet, 'create', async () => assert.fail('Existing tweet must not be recreated'));
  await collectTweetsForLiveMatches([{
    match_id: 987655, date: kickoff, teams: { home: { team_id: 1 }, away: { team_id: 2 } }
  }]);
  assert.equal(create.mock.callCount(), 0);
  assert.deepEqual(update.mock.calls[0].arguments[1], {
    $addToSet: { reporter_matches: { match_id: 987655, team_id: 1 } }
  });
});
