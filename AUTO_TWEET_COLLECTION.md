# Auto Tweet Collection for Match Reports

## Problem
Tweets need to be collected **immediately after a match** and **before report generation** to provide social context. A cron job running every 4 hours is too infrequent and poorly timed.

## Solution
**Integrated auto-collection in the report pipeline** - the system now automatically checks and collects tweets as part of the report generation process.

## How It Works

### 1. Pre-Generation Check
When generating a report, the pipeline:
- Checks if tweets exist for the match
- Counts tweets from 2 hours before to 3 hours after kickoff
- If fewer than required minimum (default: 5), triggers collection

### 2. Auto-Collection
If needed:
- Uses TwitterAPI.io to search for match-related tweets
- Searches both team names and match-specific terms
- Saves up to 50 tweets per match
- Takes ~2-5 seconds typically

### 3. Report Generation
- Proceeds with freshly collected tweets
- Tweets are available for AI interpretation
- Best tweets are embedded in the final report

## Configuration

### Enable/Disable
```javascript
await generateReportPipeline({
  matchId: 19432238,
  teamSlug: 'wrexham',
  options: {
    autoCollectTweets: true,      // Enable (default: true)
    minTweetsRequired: 5           // Minimum tweets (default: 5)
  }
});
```

### Disable Auto-Collection
```javascript
options: {
  autoCollectTweets: false  // Skip auto-collection
}
```

## Benefits

✅ **Always Fresh** - Tweets collected right when needed
✅ **Self-Contained** - No dependency on cron timing
✅ **Graceful Fallback** - Reports still work if Twitter API fails
✅ **Efficient** - Only collects when necessary
✅ **Works Everywhere** - Manual and automatic report generation

## Requirements

- `TWITTERAPI_KEY` environment variable must be set
- If not configured, auto-collection is skipped (reports work without tweets)

## Testing

Run the test script:
```bash
node test_auto_tweet_collection.js
```

This will:
1. Check existing tweets
2. Auto-collect if needed
3. Generate a report with tweet context
4. Show embedded tweets in output

## Monitoring

The pipeline logs show auto-collection activity:
```
[ReportPipeline] Found 2 existing tweets for match 19432238
[ReportPipeline] 🐦 Auto-collecting tweets (need 5, have 2)...
[ReportPipeline] ✅ Tweet collection complete: 8 saved, 0 skipped (2340ms)
[ReportPipeline] Fetched 10 tweets for report context
```

## Alternative: Match Status Webhook

For even better timing, you could add a webhook that triggers when match status changes to "FT" (full time):

```javascript
// In matchController.js
if (match.status === 'FT' && oldStatus !== 'FT') {
  // Match just finished - trigger tweet collection
  await twitterService.searchMatchTweets(match);
  // Then trigger report generation
  await generateReportPipeline({ matchId, teamSlug: homeTeam.slug });
}
```

This ensures tweets are collected the moment a match ends.
