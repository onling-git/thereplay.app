# Match Statistics Implementation

This document outlines the implementation of match statistics feature for both in-game and post-match statistics display.

## Overview

The match statistics feature allows the frontend to fetch and display detailed match statistics from the SportMonks API, including data such as:

- Possession percentage
- Shots on/off target
- Corners
- Fouls
- Yellow/red cards
- Passes completed
- And many more statistical categories

## Backend Implementation

### 1. API Endpoint Enhancement

**Endpoint:** `GET /api/:teamSlug/match/:matchId`

**New Query Parameter:**
- `include_statistics=true` - Fetches match statistics from SportMonks API

**Example:**
```
GET /api/southampton/match/19432044?include_statistics=true
```

### 2. Backend Components Modified

#### `backend/controllers/matchController.js`
- Added `include_statistics` parameter handling
- Added `transformStatistics()` helper function
- Enhanced `getMatchByTeamAndId()` to fetch and cache statistics
- Implements caching to avoid redundant API calls (1-hour cache window)

#### `backend/controllers/matchSyncController.js`
- Enhanced `fetchMatchStats()` to include statistics in SportMonks API calls
- Added statistics to the list of includes when `opts.includeStatistics` is true

### 3. Data Flow

1. Frontend requests match data with `include_statistics=true`
2. Backend checks if statistics are already cached (< 1 hour old)
3. If not cached, fetches fresh data from SportMonks API with statistics included
4. Transforms SportMonks statistics format to our database schema
5. Stores statistics in database for caching
6. Returns match data with statistics to frontend

### 4. Database Schema

The `Match` model already includes a statistics field:

```javascript
statistics: {
  home: { type: [mongoose.Schema.Types.Mixed], default: [] },
  away: { type: [mongoose.Schema.Types.Mixed], default: [] }
}
```

Each statistic entry contains:
```javascript
{
  type_id: Number,        // SportMonks type ID
  type: String,           // Human readable type name
  value: Number,          // Statistic value
  participant_id: Number  // Team ID from SportMonks
}
```

## Frontend Implementation

### 1. API Integration

The frontend already supports the `includeStatistics` parameter in the `getMatch()` function:

```javascript
// frontend/src/api.js
export async function getMatch(teamSlug, matchId, options = {}) {
  const { enrichLineup = false, includeStatistics = false } = options;
  // ... implementation includes includeStatistics in query params
}
```

### 2. Statistics Display

**Component:** `frontend/src/pages/MatchLive.jsx`

The statistics are displayed in the "Stats" tab with:
- Team vs team header showing both team names
- Grid layout showing each statistic type with home and away values
- Color-coded values (blue for home team, red for away team)
- Responsive design for mobile devices

### 3. Display Logic

Statistics are only shown when:
- Match is in progress (`1H`, `2H`, `HT`, etc.) or finished (`FT`, `FINISHED`)
- Statistics data is available from the API
- Otherwise shows appropriate "not available" messages

## Usage Examples

### 1. Fetch Match with Statistics (Frontend)

```javascript
import { getMatch } from '../api';

const matchData = await getMatch('southampton', '19432044', { 
  enrichLineup: true, 
  includeStatistics: true 
});

console.log(matchData.statistics.home); // Array of home team stats
console.log(matchData.statistics.away); // Array of away team stats
```

### 2. Display Statistics in Component

```jsx
const statistics = matchSnapshot?.statistics;
if (statistics && (statistics.home?.length || statistics.away?.length)) {
  // Display statistics grid
  statistics.home.forEach(stat => {
    console.log(`${stat.type}: ${stat.value}`);
  });
}
```

### 3. Backend API Call

```bash
curl "http://localhost:3001/api/southampton/match/19432044?include_statistics=true"
```

## Testing

A test script is available to verify the statistics functionality:

```bash
cd backend
node test_statistics_endpoint.js
```

This test:
1. Fetches statistics directly from SportMonks API
2. Tests the local API endpoint
3. Verifies data transformation
4. Provides detailed logging of the process

## SportMonks API Integration

The system uses the SportMonks v3 API with the following include parameter:
```
include=statistics;participants;state;comments;scores
```

**Reference URL Format:**
```
https://api.sportmonks.com/v3/football/fixtures/{matchId}?api_token={token}&include=statistics
```

## Error Handling

- Graceful fallback if statistics are unavailable
- Caching prevents excessive API calls
- Non-blocking implementation (match data loads even if statistics fail)
- Appropriate user messaging when statistics are not available

## Performance Considerations

- **Caching:** Statistics are cached for 1 hour to reduce API calls
- **Conditional Loading:** Statistics only fetched when explicitly requested
- **Fallback Graceful:** Page loads normally even if statistics fail
- **Rate Limiting:** Respects SportMonks API rate limits

## Future Enhancements

Potential improvements for the statistics feature:

1. **Real-time Updates:** Include statistics in SSE (Server-Sent Events) updates
2. **Historical Stats:** Store statistics for trend analysis
3. **Visual Charts:** Add graphs and charts for better visualization
4. **Team Comparisons:** Compare statistics across multiple matches
5. **Player Statistics:** Individual player statistics within matches

## Configuration

No additional configuration is required. The feature works with existing:
- SportMonks API credentials
- Database connection
- Frontend API integration

The statistics will automatically appear in the match live stats tab when available.