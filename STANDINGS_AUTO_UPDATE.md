# Standings Auto-Update System

## Overview

Standings are now automatically kept fresh using a two-tier update strategy:

1. **Match-based updates** - Standings sync when matches finish
2. **Daily backup** - Full refresh of all leagues at 3 AM

This minimizes API calls while keeping standings current.

---

## How It Works

### 1. Match Finish Trigger

When a match finishes:
1. Match webhook processes the finished match
2. Reports are generated for both teams
3. **Standings are synced** for that match's league
4. Smart caching prevents duplicate syncs (10-minute cooldown per league)

**Example**: Three Premier League matches finish Saturday evening between 5-6 PM:
- First match triggers standings sync → ✅ Synced
- Second match (5 min later) → ⏭️ Skipped (cached)
- Third match (8 min later) → ⏭️ Skipped (cached)
- Result: Only 1 API call instead of 3

### 2. Daily Backup Sync

Every day at **3 AM**:
- All available leagues are synced
- 2-second delay between leagues to respect rate limits
- Catches any leagues that didn't have matches
- Ensures all standings are fresh daily

**Leagues synced:**
- Premier League (England)
- Championship (England)
- FA Cup (England)
- Carabao Cup (England)
- La Liga (Spain)
- Bundesliga (Germany)
- Serie A (Italy)
- Ligue 1 (France)
- And 30+ more...

---

## Files Modified

### 1. `backend/webhooks/matchStatusWebhook.js`

Added standings sync to match finish processing:

```javascript
// After reports are generated...
await updateStandingsForMatch(match);
```

**Key features:**
- Extracts league ID from match
- Checks cache to prevent duplicate syncs
- Syncs standings via `syncStandingsByLeague()`
- 10-minute cooldown per league

### 2. `backend/cron/cronOptimizedV2.js`

Added daily cron job at 3 AM:

```javascript
cron.schedule('0 3 * * *', async () => {
  const leagueIds = Object.keys(AVAILABLE_LEAGUES);
  await syncMultipleLeagues(leagueIds, 2000);
});
```

**Key features:**
- Syncs all available leagues
- 2-second delay between requests
- Logs success/failure for each league

---

## Testing

### Manual Test

Run the test script to verify standings sync:

```bash
cd backend
node test_standings_sync.js
```

This will:
1. Show current standings in database
2. Sync fresh data from API
3. Verify database was updated
4. Display before/after comparison

### Check Logs

When matches finish, you should see:

```
[processFinishedMatch] 🎉 Processing complete for match 19631550 (25 tweets, 2 reports)
[updateStandingsForMatch] 📊 Syncing standings for league 8...
[standings] League: Premier League, Season: 2025/2026 (21859)
[standings] ✅ Synced Premier League - 2025/2026
[updateStandingsForMatch] ✅ Standings synced: Premier League (20 teams)
```

---

## API Efficiency

### Before (No Auto-Update)
- Standings only updated via manual admin API calls
- Frontend showed stale data
- Users saw incorrect league positions

### After (Auto-Update)
- Standings update automatically when matches finish
- Smart caching prevents duplicate API calls
- Daily backup ensures complete coverage
- **Estimated API calls:** ~50-60 per day
  - Match-based: ~20-30 (depending on match day)
  - Daily backup: ~45 leagues at 3 AM

### Rate Limit Compliance
- Sportmonks API limit: 3,000 calls/hour
- Our usage: ~2.5 calls/hour average
- Peak usage (match days): ~10 calls/hour
- Well within limits ✅

---

## Frontend Updates

Standings automatically update on:
- Match live pages (StandingsPositionCard)
- Team pages showing league position
- League standings pages

No frontend changes needed - data is fetched from API which now serves fresh data.

---

## Monitoring

### Check Current Standings

```bash
cd backend
node check_all_standings.js
```

Shows all leagues with standings in database and last update time.

### Force Manual Sync

If needed, you can manually trigger sync via admin API:

```bash
# Sync specific league
curl -X POST http://localhost:8000/api/standings/sync/league/8 \
  -H "x-api-key: YOUR_ADMIN_KEY"

# Batch sync multiple leagues
curl -X POST http://localhost:8000/api/standings/sync/batch \
  -H "x-api-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"league_ids": [8, 9, 24], "delay_ms": 500}'
```

---

## Troubleshooting

### Standings not updating after match finishes?

1. Check match webhook is being called:
   - Look for logs: `[MatchStatusWebhook] Received update: match XXX`

2. Check if standings sync was triggered:
   - Look for: `[updateStandingsForMatch] 📊 Syncing standings`

3. Check for cache skip:
   - If you see `⏭️ Standings were synced X min ago, skipping` - this is normal behavior

4. Verify league has standings data:
   - Run: `node test_standings_sync.js`

### Daily cron not running?

1. Check cron is started in server.js
2. Check server logs at 3 AM for: `[cron] Starting daily standings refresh`
3. Verify timezone settings (3 AM server time)

### API rate limit errors?

If you see 429 errors:
- Daily cron has 2-second delays between leagues
- Match-based sync has 10-minute cooldown
- Should not hit rate limits under normal usage

---

## Future Enhancements

Potential improvements:
1. **Webhook from Sportmonks** - Get notified when standings change
2. **Live standings** - Use `/standings/live/leagues/:id` endpoint during matches
3. **Selective sync** - Only sync leagues with matches today
4. **Version tracking** - Track standings changes over time for analytics

---

## Summary

✅ Standings now update automatically
✅ Smart caching minimizes API calls
✅ Daily backup ensures complete coverage
✅ Efficient and rate-limit compliant
✅ No frontend changes needed

The standings display issue is resolved!
