# Reporter tweets and X report publishing

The fan hashtag feed continues to use TwitterAPI.io. Reporter collection and
report publishing are independently configurable and disabled for the official
API unless explicitly enabled.

## Reporter collection

Live matches collect configured reporter accounts periodically, starting at
kickoff, without requiring team hashtags. Before generating a report the
pipeline collects again even when reporter tweets are already saved.
Reports proceed with previously saved tweets if collection fails. There is
no deliberate post-match wait. The former `minTweetsRequired` option no
longer controls collection. Report interpretation receives up to ten posts:
the first five and the latest five, in chronological order.
Reporter posts already stored for the fan feed or another team retain their
existing data and receive an additional match/team association.

The default `REPORTER_TWEET_PROVIDER=twitterapi` preserves the existing
provider. To use the official recent-search API, set
`REPORTER_TWEET_PROVIDER=x` and configure `X_API_BEARER_TOKEN`. Set
`X_REPORTER_FALLBACK_ENABLED=true` and `TWITTERAPI_KEY` to automatically use
TwitterAPI.io when an official search fails. An empty successful search does
not trigger fallback.

Official searches store a match/team/reporter checkpoint after returned posts
are saved. Each search overlaps the previous successful window by two minutes
to help with indexing delays. Checkpoints expire after 30 days. A search is
limited to three pages of up to 100 posts; exceeding that limit is an error,
not a successful partial result. X recent search only covers the last seven
days. Search logs report returned post and user counts, not billing totals.
The existing 30-day tweet-retention job also applies to official API posts.

## Publishing

`X_REPORT_PUBLISH_MODE` defaults to `off`. With `dry-run` or `live`, newly
created reports are queued in the report document; updating an existing report
does not create another post. The post contains the headline, the team's
primary hashtag and its public team-specific report URL. A missing hashtag,
invalid link, or unlinked/non-public match is recorded as a failure.

The worker claims reports atomically. A report save triggers it immediately;
the cron worker also checks pending reports every minute when `ENABLE_CRON`
is enabled. Rate-limit responses are retried up to three attempts with a
15-minute interval. An ambiguous timeout, server error, or interrupted
in-flight request is marked `uncertain` and is not automatically retried:
check the account before taking manual action. `sending`, `failed`, and
`uncertain` states require operational attention. Reports remain available
even if publishing fails.

`dry-run` records the generated text without calling X; it does not switch
to a real post when the mode changes. Live publishing on staging requires
`X_REPORT_ALLOW_STAGING_LIVE=true` and an explicitly configured non-production
site URL. Use a separate staging database and test account, and do not point
staging at production data or use production account credentials. For live
mode configure the app's OAuth 1.0a read/write keys
and user access tokens: `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, and
`X_ACCESS_TOKEN_SECRET`. The optional `X_REPORT_SITE_URL` must be an HTTPS
origin and defaults to `https://thereplay.app`.

## Cost and testing

Set a spending limit in the X developer console before enabling paid use.
X bills returned resources and publishing requests, and prices can change.
Reporter searches request author expansions as well as posts, so returned
users may also incur User: Read charges. The local counters are not an
invoice or a hard spending cap. TwitterAPI.io
fallback has its own costs and limits. Keep both new features off until
credentials, access, policy compliance and a small-budget live test have
been verified.

Offline tests use mocked responses and do not contact X:

```text
node --test test_x_staging_fixture.js test_live_tweet_collector.js test_x_reporter_search.js test_reporter_tweet_provider.js test_x_report_publisher.js test_report_pipeline_v4.js test_report_controller_v4.js
```
