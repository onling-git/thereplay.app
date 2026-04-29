# Fixture Timezone Issue - Root Cause and Fix

## Problem Summary

Fixture times were displaying incorrectly on the frontend by 2 hours. For example:
- Match at 15:00 UK time (BST = UTC+1) → Should be 14:00 UTC → Should display as 16:00 in CEST browsers
- But was displaying as 14:00 in CEST browsers (2 hours wrong)

## Root Cause

The issue was in how we handle Sportmonks' `starting_at` field:

1. **Sportmonks API Behavior:**
   - `starting_at_timestamp`: Always in UTC (Unix seconds) ✅
   - `starting_at` string: Format `YYYY-MM-DD HH:mm:ss` (no timezone indicator)
   - When NO `timezone` parameter is used: `starting_at` is in UTC
   - When `timezone` parameter IS used: `starting_at` is in LOCAL TIME (but looks the same!)

2. **Our Bug:**
   - We were **recalculating** `starting_at_timestamp` from the `starting_at` string
   - Our `parseProviderDate()` function treats `YYYY-MM-DD HH:mm:ss` as UTC (appends 'Z')
   - This works fine when no timezone param is used
   - But breaks when timezone param is used (we treat local time as UTC)

3. **Example:**
   ```javascript
   // API call: /fixtures/19432260?timezone=Europe/London
   // Sportmonks returns:
   {
     starting_at: "2026-04-18 15:00:00",  // 15:00 London time (local)
     starting_at_timestamp: 1776520800    // 14:00 UTC (correct!)
   }
   
   // Our buggy code did:
   const date = new Date("2026-04-18 15:00:00" + "Z");  // Treats as 15:00 UTC ❌
   const timestamp = Math.floor(date.getTime() / 1000); // 1776524400 (wrong!)
   ```

## Fix Applied

### 1. `/backend/utils/normaliseFixture.js`

Changed to **always use `starting_at_timestamp` directly from Sportmonks** instead of recalculating:

```javascript
// BEFORE (buggy):
const date = parseProviderDate(fixture.starting_at);
const starting_at_timestamp = Math.floor(date.getTime() / 1000);

// AFTER (correct):
const providerTimestamp = fixture.starting_at_timestamp;
const hasProviderTimestamp = Number.isFinite(Number(providerTimestamp));

let safeDate;
if (hasProviderTimestamp) {
  // Use provider timestamp (guaranteed UTC)
  safeDate = new Date(Number(providerTimestamp) * 1000);
} else {
  // Fallback: parse starting_at string (risky)
  safeDate = parseProviderDate(fixture.starting_at);
}

// Use provider timestamp directly
match_info.starting_at_timestamp = hasProviderTimestamp 
  ? Number(providerTimestamp)
  : Math.floor(safeDate.getTime() / 1000);
```

### 2. `/backend/controllers/syncController.js`

Applied same fix to the minimal fixture processing logic.

## Verification

Test script: `backend/test_fixture_timezone.js`

```bash
node backend/test_fixture_timezone.js 19432260
```

**Result:**
- WITHOUT timezone param: timestamp = 1776520800 ✅
- WITH timezone param: timestamp = 1776520800 ✅ (same - correct!)

## How to Fix Existing Database

Upcoming fixtures in the database have incorrect times that were saved with the old buggy logic.

### Fix Script: `backend/fix_fixture_times.js`

```bash
# Fix a single match
node backend/fix_fixture_times.js single 19432260

# Fix all upcoming fixtures (next 14 days)
node backend/fix_fixture_times.js upcoming 14

# Fix all upcoming fixtures (next 7 days)
node backend/fix_fixture_times.js upcoming 7
```

This script:
1. Fetches fresh data from Sportmonks (without timezone param)
2. Uses the new fixed normalization logic
3. Updates ONLY time-related fields in the database

## Frontend Display (Already Correct)

The frontend code in `LiveScoreCards.jsx` was already correct:

```javascript
// Uses starting_at_timestamp (priority)
const matchDate = new Date(match.match_info.starting_at_timestamp * 1000);

// Converts to user's timezone
return new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: userTimezone
}).format(matchDate);
```

The frontend was displaying what the database contained - the database had wrong times.

## Prevention

**Always use `starting_at_timestamp` from Sportmonks:**
- ✅ It's always in UTC
- ✅ It's consistent regardless of timezone parameters
- ✅ It's a number (Unix seconds), not an ambiguous string

**Never recalculate timestamp from `starting_at` string:**
- ❌ The string format has no timezone indicator
- ❌ It can be in UTC or local time depending on API parameters
- ❌ Parsing it is unreliable

## Testing

After applying the fix:

1. **Run the fix script:**
   ```bash
   node backend/fix_fixture_times.js upcoming 14
   ```

2. **Verify on frontend:**
   - Check fixtures page
   - Confirm times display correctly for your timezone
   - Example: April 18 match at 15:00 UK (BST)
     - UTC: 14:00
     - CEST browser: 16:00
     - EST browser: 10:00

3. **Test new fixtures:**
   - Sync new fixtures from Sportmonks
   - Verify they have correct times immediately

## Files Changed

- ✅ `backend/utils/normaliseFixture.js` - Primary fix
- ✅ `backend/controllers/syncController.js` - Secondary fix
- ➕ `backend/test_fixture_timezone.js` - Test script
- ➕ `backend/fix_fixture_times.js` - Database fix script
- 📄 `FIXTURE_TIMEZONE_FIX.md` - This documentation

## Related Issues

This issue has been recurring because:
1. We fixed display bugs but not the root cause (data storage)
2. Tests might have passed with mock data that didn't expose the timezone ambiguity
3. The bug only manifests when timezone parameters are involved

**The core lesson:** When an API field can vary based on parameters, always use the most reliable field (timestamp) rather than parsing ambiguous strings.
