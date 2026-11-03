const Tweet = require('../models/Tweet');
const Report = require('../models/Report');
const ReportStaging = require('../models/ReportStaging');
const ReportGenerationTrace = require('../models/ReportGenerationTrace');

const TWEET_RETENTION_DAYS = 30;
const TWEET_RETENTION_MS = TWEET_RETENTION_DAYS * 24 * 60 * 60 * 1000;

function retainedTweets(path, cutoff) {
  return {
    $filter: {
      input: { $cond: [{ $isArray: `$${path}` }, `$${path}`, []] },
      as: 'tweet',
      cond: {
        $gt: [
          { $convert: { input: '$$tweet.created_at', to: 'date', onError: null, onNull: null } },
          cutoff
        ]
      }
    }
  };
}

async function pruneCopies(model, path, cutoff, unsetFields = []) {
  const retained = retainedTweets(path, cutoff);
  const query = {
    [path]: { $type: 'array' },
    $expr: {
      $gt: [
        { $size: { $cond: [{ $isArray: `$${path}` }, `$${path}`, []] } },
        { $size: retained }
      ]
    }
  };
  const update = [{ $set: { [path]: retained } }];
  if (unsetFields.length) update.push({ $unset: unsetFields });
  // Native updates preserve article timestamps and support the Mixed debug snapshots.
  return model.collection.updateMany(query, update);
}

async function purgeExpiredTweets(now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new TypeError('Tweet retention requires a valid date');
  }
  const cutoff = new Date(now.getTime() - TWEET_RETENTION_MS);
  const counts = { deleted_tweets: 0, modified_documents: 0 };

  const deleted = await Tweet.deleteMany({ created_at: { $lte: cutoff } });
  counts.deleted_tweets = deleted.deletedCount;

  // A recent post can quote or retweet a much older post.
  for (const path of ['retweetedTweet', 'quotedTweet']) {
    const result = await Tweet.collection.updateMany(
      { [`${path}.created_at`]: { $lte: cutoff } },
      { $unset: { [path]: '', api_response_meta: '' } }
    );
    counts.modified_documents += result.modifiedCount;
  }

  const copies = [
    [Report, 'embedded_tweets'],
    [Report, 'generated.embedded_tweets'],
    [ReportStaging, 'report.embedded_tweets'],
    [ReportStaging, 'report.generated.embedded_tweets'],
    [ReportGenerationTrace, 'run2.output.embedded_tweets'],
    [ReportGenerationTrace, 'run2.output.generated.embedded_tweets'],
    [ReportGenerationTrace, 'run2.output.assembled_report.embedded_tweets'],
    [ReportGenerationTrace, 'run2.output.assembled_report.generated.embedded_tweets']
  ];
  for (const [model, path] of copies) {
    const result = await pruneCopies(model, path, cutoff);
    counts.modified_documents += result.modifiedCount;
  }

  // Prompts duplicate the raw input text. Drop the whole prompt if any source expires.
  // Legacy snapshots without posting dates are removed rather than retained indefinitely.
  const traces = await pruneCopies(
    ReportGenerationTrace, 'run1.input_snapshot.tweets', cutoff,
    ['run1.prompt', 'run1.repair_prompt']
  );
  counts.modified_documents += traces.modifiedCount;
  return counts;
}

module.exports = { purgeExpiredTweets, TWEET_RETENTION_DAYS, TWEET_RETENTION_MS };
