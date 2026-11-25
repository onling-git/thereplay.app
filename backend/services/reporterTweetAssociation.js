const Tweet = require('../models/Tweet');

async function associateReporterTweet(tweetId, matchId, teamId) {
  const result = await Tweet.updateOne(
    { tweet_id: tweetId },
    { $addToSet: { reporter_matches: { match_id: Number(matchId), team_id: Number(teamId) } } }
  );
  if (!result.matchedCount) throw new Error(`Reporter tweet ${tweetId} disappeared before association`);
}

module.exports = { associateReporterTweet };
