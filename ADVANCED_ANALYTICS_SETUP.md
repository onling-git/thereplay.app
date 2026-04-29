# Advanced Match Analytics Setup

## Overview

This document describes the implementation of advanced match analytics collection from the SportMonks API, including:
- **Pressure Index**: Minute-by-minute pressure data for each team
- **Ball Coordinates**: Positional tracking data for ball movement
- **Trends**: Tactical and statistical trends during matches

## Availability

These advanced analytics are:
- Available only for **select top-tier matches** (major leagues, high-profile games)
- **May not be included in all API plans** (check your SportMonks subscription)
- **Automatically collected when available** - the system gracefully handles missing data

## Data Structure

### Pressure Index

Stored as an array of objects in the `pressure` field of the Match model:

```javascript
{
  "id": 941884259,
  "fixture_id": 18804442,
  "participant_id": 2930,
  "minute": 6,
  "pressure": 0
}
```

Each entry represents the pressure value for a specific team at a specific minute.

### Ball Coordinates

Stored as an array in the `ball_coordinates` field:
- Contains positional data for ball movement
- Format depends on SportMonks API response structure

### Trends

Stored as an array in the `trends` field:
- Contains tactical and statistical trend data
- Format depends on SportMonks API response structure

## Implementation Details

### 1. Match Model (`backend/models/Match.js`)

Added three new fields to the Match schema:

```javascript
// Advanced match analytics from SportMonks API (available for select matches)
pressure: { type: [mongoose.Schema.Types.Mixed], default: [] },
ball_coordinates: { type: [mongoose.Schema.Types.Mixed], default: [] },
trends: { type: [mongoose.Schema.Types.Mixed], default: [] }
```

### 2. Match Sync Controller (`backend/controllers/matchSyncController.js`)

Updated `fetchMatchStats()` to include advanced analytics in API requests:

```javascript
// Advanced analytics includes (pressure, ballcoordinates, trends)
// These are available for select top-tier matches only
const advancedIncludes = opts.includeAdvanced !== false 
  ? ';pressure;ballcoordinates;trends' 
  : '';
```

The sync controller automatically:
- Requests these data types with every match fetch
- Handles gracefully when data is not available (doesn't throw errors)
- Saves data to the database when present

### 3. Normalization Utility (`backend/utils/normaliseFixture.js`)

Added extraction logic to process advanced analytics from SportMonks responses:

```javascript
// Process advanced analytics (pressure index, ball coordinates, trends)
const pressure = Array.isArray(fixture.pressure?.data) 
  ? fixture.pressure.data 
  : Array.isArray(fixture.pressure) 
  ? fixture.pressure 
  : [];

const ball_coordinates = Array.isArray(fixture.ballcoordinates?.data) 
  ? fixture.ballcoordinates.data 
  : Array.isArray(fixture.ballcoordinates) 
  ? fixture.ballcoordinates 
  : [];

const trends = Array.isArray(fixture.trends?.data) 
  ? fixture.trends.data 
  : Array.isArray(fixture.trends) 
  ? fixture.trends 
  : [];
```

## Usage

### Automatic Collection

The system automatically collects these analytics for **all matches** when:
1. Match data is synced via `syncFinishedMatch()`
2. Match statistics are fetched via `fetchMatchStats()`
3. CRON jobs run periodic match updates

No additional configuration is required - the system attempts to fetch the data and stores it when available.

### Disabling Advanced Analytics

To disable collection of advanced analytics (e.g., to reduce API quota usage):

```javascript
const matchData = await fetchMatchStats(matchId, { 
  includeAdvanced: false 
});
```

### Accessing the Data

Retrieve advanced analytics from a match:

```javascript
const match = await Match.findOne({ match_id: 18804442 });

// Access pressure index data
if (match.pressure && match.pressure.length > 0) {
  console.log('Pressure data available:', match.pressure);
}

// Access ball coordinates
if (match.ball_coordinates && match.ball_coordinates.length > 0) {
  console.log('Ball tracking data available:', match.ball_coordinates);
}

// Access trends
if (match.trends && match.trends.length > 0) {
  console.log('Trends data available:', match.trends);
}
```

### API Endpoints

The advanced analytics are automatically included when fetching match details:

```
GET /api/matches/:id?include_statistics=true
```

The response will include `pressure`, `ball_coordinates`, and `trends` fields when available.

## Error Handling

The implementation includes robust error handling:

1. **Missing Data**: If data is not available for a match, the fields remain as empty arrays `[]`
2. **API Plan Limitations**: If your API plan doesn't include these endpoints, the request falls back to standard includes
3. **No Breaking Changes**: Existing functionality continues to work - these are additive features

## SportMonks API Documentation

For detailed information about these data types, see:
- [Pressure Index](https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/includes/pressure-index)
- [Ball Coordinates](https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/includes/ballcoordinates)
- [Trends](https://docs.sportmonks.com/v3/tutorials-and-guides/tutorials/trends)

## Future Considerations

### API Plan Upgrade

If you don't currently have access to these features:
1. Data collection is already implemented
2. Once you upgrade your SportMonks plan, data will automatically start being collected
3. No code changes needed

### Frontend Display

Consider implementing:
- Pressure index visualizations (heatmaps, line charts)
- Ball movement tracking displays
- Trend analysis dashboards

### Analytics

Potential use cases:
- Enhanced match reports with pressure statistics
- Tactical analysis based on ball possession patterns
- Performance trends over time

## Testing

To verify the implementation:

1. **Check if data is being collected**:
   ```javascript
   const match = await Match.findOne({ match_id: YOUR_MATCH_ID });
   console.log('Pressure:', match.pressure?.length || 0, 'entries');
   console.log('Ball coordinates:', match.ball_coordinates?.length || 0, 'entries');
   console.log('Trends:', match.trends?.length || 0, 'entries');
   ```

2. **Test with a top-tier match** (e.g., Champions League, Premier League):
   - These are most likely to have advanced analytics available
   - Sync a recent high-profile match and check the data

3. **Monitor API logs**:
   - Look for `[sportmonks]` log entries
   - Verify includes contain `pressure;ballcoordinates;trends`

## Notes

- Data is stored exactly as received from SportMonks (using Mixed schema type)
- No data transformation or aggregation is performed
- Historical matches may not have this data available
- Data availability varies by league and match importance
