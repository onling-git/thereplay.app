# League Management System

## Overview

The League Management System allows you to control which leagues and countries are actively monitored **without changing code**. All configuration is done through a database-backed admin interface with toggle controls.

## Key Features

- ✅ **Database-Driven**: League settings stored in MongoDB
- 🎛️ **Admin UI**: Toggle leagues on/off with a simple interface
- 🔢 **Priority System**: Control which leagues sync first
- 🌍 **Country Grouping**: Organize leagues by country
- 📊 **Statistics Dashboard**: See how many leagues are enabled at a glance
- 🚀 **Bulk Operations**: Enable/disable multiple leagues at once
- 🔍 **Search & Filter**: Find leagues quickly by name, country, or status

## Quick Start

### Step 1: Run the Migration Script

Populate the database with leagues and countries from existing match data:

```bash
cd backend
node scripts/populate_leagues_countries.js --enable-epl-championship
```

The `--enable-epl-championship` flag automatically enables Premier League (ID: 8) and Championship (ID: 9).

### Step 2: Access the Admin Panel

1. Go to `https://yourdomain.com/admin` (or `http://localhost:3000/admin` in development)
2. Log in with your admin credentials
3. Click on the **"League Management"** tab

### Step 3: Enable/Disable Leagues

- Click the toggle button next to any league to enable/disable it
- Set priorities (0-100) to control sync order
- Use bulk actions to enable/disable multiple leagues at once

## Database Schema

### League Model Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | Number | SportMonks league ID (unique) |
| `name` | String | League name (e.g., "Premier League") |
| `short_code` | String | Short code (e.g., "EPL") |
| `image_path` | String | URL to league logo |
| `country_id` | Number | Reference to Country ID |
| `type` | String | League type (league, cup, etc.) |
| `is_cup` | Boolean | Whether this is a cup competition |
| **`enabled`** | **Boolean** | **Whether to monitor this league** |
| **`priority`** | **Number** | **Sync priority (higher = first)** |

### Country Model Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | Number | SportMonks country ID (unique) |
| `name` | String | Country name |
| `iso2` | String | ISO 2-letter code |
| `iso3` | String | ISO 3-letter code |
| **`enabled`** | **Boolean** | **Whether to monitor leagues from this country** |

## API Endpoints

All endpoints require admin authentication.

### League Management

```
GET    /api/admin/leagues              - List all leagues
GET    /api/admin/leagues/stats        - Get statistics
GET    /api/admin/leagues/:leagueId    - Get single league
PATCH  /api/admin/leagues/:leagueId    - Update league settings
POST   /api/admin/leagues/bulk-update  - Bulk update multiple leagues
```

### Country Management

```
GET    /api/admin/countries            - List all countries
PATCH  /api/admin/countries/:countryId - Update country settings
```

### Query Parameters

**GET /api/admin/leagues**
- `?enabled=true` - Filter by enabled status
- `?country_id=123` - Filter by country
- `?search=premier` - Search by name or code

## Using in Your Code

### Get Enabled League IDs

Instead of hardcoding league IDs, use the helper function:

```javascript
const { getEnabledLeagueIds } = require('../utils/leagueHelper');

// OLD WAY (hardcoded)
const leagueIds = [8, 9, 24, 27]; // ❌

// NEW WAY (dynamic)
const leagueIds = await getEnabledLeagueIds(); // ✅
```

### Check if a League is Enabled

```javascript
const { isLeagueEnabled } = require('../utils/leagueHelper');

if (await isLeagueEnabled(leagueId)) {
  // Process this league
}
```

### Get Full League Details

```javascript
const { getEnabledLeagues } = require('../utils/leagueHelper');

const leagues = await getEnabledLeagues();
leagues.forEach(league => {
  console.log(`${league.name} (Priority: ${league.priority})`);
});
```

### Get Leagues Grouped by Country

```javascript
const { getLeaguesByCountry } = require('../utils/leagueHelper');

const grouped = await getLeaguesByCountry();
// Returns: { country_id: { country: {...}, leagues: [...] } }
```

## Migration Examples

### Enable Specific Leagues

```javascript
// In MongoDB shell or a script
await League.updateMany(
  { id: { $in: [8, 9, 271, 384] } }, // EPL, Championship, EFL Cup, FA Cup
  { $set: { enabled: true, priority: 100 } }
);
```

### Enable All Leagues from England

```javascript
const englandId = 462; // England's country ID
await League.updateMany(
  { country_id: englandId },
  { $set: { enabled: true } }
);
```

### Set Priorities

```javascript
await League.updateOne({ id: 8 }, { $set: { priority: 100 } }); // EPL highest
await League.updateOne({ id: 9 }, { $set: { priority: 90 } });  // Championship
await League.updateOne({ id: 271 }, { $set: { priority: 80 } }); // EFL Cup
```

## Integration Points

### Update Existing Scripts

Replace hardcoded league arrays with the helper function:

**scripts/ensure_all_reports.js**
```javascript
const { getEnabledLeagueIds } = require('../utils/leagueHelper');

// OLD: if (!options.leagues) options.leagues = [8, 9, 24, 27, 390, 570, 1371];
// NEW:
if (!options.leagues) {
  options.leagues = await getEnabledLeagueIds();
}
```

**scripts/run_cron_now.js**
```javascript
const { getEnabledLeagueIds } = require('../utils/leagueHelper');

// OLD: const DEFAULT_LEAGUE_IDS = [8, 9, 271];
// NEW:
const leagueIds = await getEnabledLeagueIds();
```

### Update Controllers

**controllers/syncController.js**
```javascript
const { isLeagueEnabled } = require('../utils/leagueHelper');

async function shouldSyncFixture(fixtureId) {
  const fixture = await getFixture(fixtureId);
  const leagueId = fixture.league_id;
  
  return await isLeagueEnabled(leagueId);
}
```

## Admin UI Features

### Search & Filter
- **Search bar**: Find leagues by name or short code
- **Status filter**: Show all, enabled only, or disabled only
- **Country filter**: Filter by specific country

### Bulk Actions
1. Select multiple leagues using checkboxes
2. Click "Enable Selected" or "Disable Selected"
3. Changes apply immediately

### Priority Management
- Higher priority leagues sync first
- Recommended values:
  - 100: Top priority (Premier League)
  - 90: High priority (Championship)
  - 80: Medium-high (Cups)
  - 50: Medium (Other major leagues)
  - 0: Default

### Statistics Dashboard
- Total leagues vs. enabled leagues
- Total countries vs. enabled countries
- Updates in real-time after changes

## Troubleshooting

### Issue: Leagues not appearing in admin

**Solution**: Run the migration script to populate from existing matches:
```bash
node scripts/populate_leagues_countries.js
```

### Issue: Changes not taking effect

**Solution**: 
1. Check if you're using the helper functions (`getEnabledLeagueIds()`)
2. Restart your server if you're still using hardcoded values
3. Update your code to use the dynamic helper functions

### Issue: No leagues in database

**Solution**: Make sure you have match data first. The migration pulls leagues from existing matches.

### Issue: Can't access admin panel

**Solution**: 
1. Ensure you're logged in as an admin user
2. Check that your role is `'admin'` or `'super_admin'`
3. Verify the route is mounted in `server.js`

## Best Practices

1. **Always use helper functions** instead of hardcoding league IDs
2. **Set meaningful priorities** to control sync order
3. **Test with a few leagues first** before enabling many
4. **Monitor performance** when enabling new leagues
5. **Keep the migration script** for re-populating if needed
6. **Document which leagues you're monitoring** for your team

## Files Created/Modified

### Backend
- ✅ `models/League.js` - Added `enabled` and `priority` fields
- ✅ `models/Country.js` - Added `enabled` field
- ✅ `controllers/adminLeagueController.js` - New controller
- ✅ `routes/adminLeagueRoutes.js` - New routes
- ✅ `utils/leagueHelper.js` - Helper functions
- ✅ `scripts/populate_leagues_countries.js` - Migration script
- ✅ `server.js` - Mounted new routes

### Frontend
- ✅ `api/adminApi.js` - Added league management API calls
- ✅ `components/Admin/LeagueManagement.jsx` - New component
- ✅ `components/Admin/LeagueManagement.css` - Styles
- ✅ `components/Admin/AdminPanel.jsx` - Added League tab

## Next Steps

1. Run the migration script to populate your database
2. Access the admin panel and enable your target leagues
3. Update your existing scripts to use `getEnabledLeagueIds()`
4. Test sync operations with the new league filter
5. Monitor and adjust priorities as needed

## Support

For questions or issues with the League Management System:
1. Check this documentation first
2. Review the admin panel UI for helpful tooltips
3. Check the console for error messages
4. Verify database connectivity and admin permissions
