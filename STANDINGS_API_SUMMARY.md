# Standings API Integration Summary

## Overview
This document summarizes the research and testing of the Sportmonks Standings API integration for thefinalplay.com.

## API Endpoint Structure

### Working Endpoint
- **URL**: `/standings/seasons/{seasonId}`
- **Method**: GET
- **Base URL**: `https://api.sportmonks.com/v3/football`

### Not Available in Current Plan
- `/standings/live/leagues/{leagueId}` - Returns error code 5007 (endpoint not accessible)

## Available Include Parameters

All of the following includes work individually:
- `participant` - Returns full team details
- `season` - Returns season information  
- `league` - Returns league information
- `stage` - Returns stage information (e.g., "Regular Season")
- `group` - Returns group info (null for leagues, used in cups)
- `round` - Returns current round details
- `rule` - Returns standing rule info (for promotion/relegation zones)
- `details` - Returns detailed statistics array ⭐ **IMPORTANT**
- `form` - Returns recent form (W/L/D array with fixture IDs)

**Note**: Includes cannot be combined with all parameters at once. Need to test combinations if multiple includes are needed.

## Response Data Structure

### Base Standing Object
Each standing entry contains:
```javascript
{
  "id": 258296,                    // Unique standing entry ID
  "participant_id": 19,           // Team ID
  "sport_id": 1,                  // Sport (1 = football)
  "league_id": 8,                 // League ID (8 = Premier League)
  "season_id": 25583,             // Season ID
  "stage_id": 77476879,           // Stage ID
  "group_id": null,               // Group (null for leagues)
  "round_id": 372147,             // Current round
  "standing_rule_id": 127301,     // Rule ID (promotion/relegation)
  "position": 1,                  // Table position
  "result": "equal",              // Trend: "up", "down", or "equal"
  "points": 70                    // Total points
}
```

### With `participant` Include
Adds full team object:
```javascript
{
  ...baseFields,
  "participant": {
    "id": 19,
    "sport_id": 1,
    "country_id": 462,
    "venue_id": 204,
    "gender": "male",
    "name": "Arsenal",
    "short_code": "ARS",
    "image_path": "https://cdn.sportmonks.com/images/soccer/teams/19/19.png",
    "founded": 1886,
    "type": "domestic",
    "placeholder": false,
    "last_played_at": "2026-04-07 19:00:00"
  }
}
```

### With `details` Include ⭐
Adds statistics array with type_id/value pairs:
```javascript
{
  ...baseFields,
  "details": [
    {
      "id": 8099019005,
      "standing_type": "standing",
      "standing_id": 258296,
      "type_id": 187,         // Type of statistic
      "value": 70             // Value
    },
    // ... more statistics
  ]
}
```

#### Known Type IDs (need to verify/map)
Based on first test results:
- `type_id: 187` → Points (70)
- `type_id: 185` → Games played (38)
- `type_id: 133` → Goals for (61)
- `type_id: 134` → Goals against (22)
- `type_id: 129` → Home wins (31)
- `type_id: 130` → Away wins (21) 
- `type_id: 131` → Home draws (7)
- `type_id: 132` → Away draws (3)
- `type_id: 135` → Home losses (15)
- `type_id: 136` → Away losses (12)
- `type_id: 141` → Unknown (16)
- `type_id: 137` → Unknown (2)

**TODO**: Get complete type_id mapping from Sportmonks documentation or testing

### With `form` Include
Adds recent form array:
```javascript
{
  ...baseFields,
  "form": [
    {
      "id": 7650273195,
      "standing_type": "standing",
      "standing_id": 258296,
      "fixture_id": 19427619,
      "form": "W",              // W = Win, L = Loss, D = Draw
      "sort_order": 17
    },
    // ... more form entries
  ]
}
```

## Implementation Steps

### 1. Backend API Routes (Recommended)
Create new routes in backend to fetch standings:

```javascript
// Backend: routes/standingsRoutes.js
GET /api/standings/league/:leagueId
GET /api/standings/season/:seasonId
GET /api/standings/league/:leagueId/current  // Gets current season standings
```

### 2. Database Schema (Future - not needed yet)
When ready to cache:

```javascript
// Minimal schema for standings
{
  season_id: Number,
  league_id: Number,
  stage_id: Number,
  round_id: Number,
  updated_at: Date,
  standings: [{
    position: Number,
    participant_id: Number,
    participant_name: String,
    points: Number,
    trend: String,  // up/down/equal
    stats: {
      played: Number,
      won: Number,
      drawn: Number,
      lost: Number,
      goals_for: Number,
      goals_against: Number,
      goal_difference: Number
    },
    form: [String]  // ["W", "W", "D", "L", "W"]
  }]
}
```

### 3. Frontend Integration
Add standings page/component:
- List view with table
- Filter by league
- Show current season by default
- Display team logos, names, positions
- Show form guide (last 5 matches)

## Test Scripts Created

1. **check_standings.js** - Basic test with participant include
2. **check_standings_detailed.js** - Test with all includes combined
3. **check_standings_includes.js** - Test each include individually ✅

## Key Findings

✅ **Working**:
- Season standings endpoint works perfectly
- All documented includes are available
- Response includes position, points, trend
- Details include provides comprehensive stats
- Form include provides recent match results

❌ **Not Available**:
- Live standings by league ID (plan restriction)

⚠️ **Caveats**:
- type_id values in details need to be mapped to stat names
- Combining all includes at once may not work (test combinations)
- Response format may differ for cups vs leagues (not yet tested)

## Next Steps

1. ✅ Understand API response structure
2. Map all type_id values to statistic names
3. Create backend API endpoints
4. Build standings model (when ready to cache)
5. Create frontend standings component
6. Test with different league types (cups, tournaments)

## Example Usage

```javascript
// Backend controller example
const { get } = require('../utils/sportmonks');

async function getStandingsByLeague(leagueId) {
  // Get current season for league
  const leagueRes = await get(`/leagues/${leagueId}`, {
    include: 'currentseason'
  });
  
  const seasonId = leagueRes.data?.data?.currentseason?.id;
  
  if (!seasonId) {
    throw new Error('No current season found');
  }
  
  // Get standings with details and participant
  const standingsRes = await get(`/standings/seasons/${seasonId}`, {
    include: 'participant,details,form'
  });
  
  return standingsRes.data?.data;
}
```

## References

- [Sportmonks Standings Documentation](https://docs.sportmonks.com/v3/endpoints-and-entities/endpoints/standings)
- Test scripts: `backend/check_standings*.js`
