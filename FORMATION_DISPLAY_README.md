# Formation Display Implementation

This document describes the implementation of formation display features for lineup data in the football match application.

## Overview

The implementation adds support for displaying player lineups in a formation view with enriched player information including:

- Player headshots/images
- Jersey numbers
- Position names (human readable)
- Formation positioning data

## Backend Changes

### 1. Schema Updates

**File: `backend/models/Match.js`**

Added new fields to both the raw `lineups` array and normalized `lineup` structure:

```javascript
// New fields added:
image_path: { type: String, default: null }, // Player headshot
position_name: { type: String, default: null }, // Human readable position
formation_field: { type: String, default: null }, // Formation field data
formation_position: { type: Number, default: null } // Formation position
```

### 2. SportMonks Player API Utilities

**File: `backend/utils/sportmonksPlayer.js`**

New utility functions for fetching and enriching player data:

- `fetchPlayerById(playerId)` - Fetch individual player details
- `fetchPlayersBatch(playerIds, options)` - Batch fetch with rate limiting
- `fetchTeamSquad(teamId, seasonId)` - Get team squad with current info
- `enrichLineupWithPlayerData(lineup, options)` - Enrich lineup with player details

### 3. Lineup Processing Updates

**File: `backend/utils/lineup.js`**

- Updated `normalizeEntry()` to include formation fields
- Added `enrichLineupData()` function for enriching home/away lineups
- Enhanced support for formation positioning data

### 4. API Endpoint Enhancement

**File: `backend/controllers/matchController.js`**

Enhanced `getMatchByTeamAndId` endpoint with optional player enrichment:

```javascript
// Usage: GET /api/:teamName/match/:matchId?enrich_lineup=true
```

When `enrich_lineup=true` is specified, the API will:
1. Fetch additional player data from SportMonks
2. Enrich lineup with jersey numbers, images, and positions
3. Return the enhanced lineup data

## Frontend Changes

### 1. API Client Updates

**File: `frontend/src/api.js`**

Updated `getMatch()` function to support lineup enrichment:

```javascript
getMatch(teamSlug, matchId, { enrichLineup: true })
```

### 2. Formation Display Component

**File: `frontend/src/pages/MatchLive.jsx`**

Enhanced the "Lineups" tab with:

- Formation grid view showing player cards
- Player images with fallback to initials
- Jersey number overlays
- Position names and ratings display
- Responsive design for mobile devices

### 3. Styling

**File: `frontend/src/pages/css/matchLive.css`**

Added comprehensive CSS for formation display:

- `.formation-display` - Main container
- `.formation-grid` - Grid layout for player cards
- `.player-card` - Individual player card styling
- `.player-image-container` - Player image with jersey number overlay
- Responsive breakpoints for mobile devices

## Usage

### Backend API

```javascript
// Basic match data
GET /api/team-slug/match/12345

// Enhanced with player details
GET /api/team-slug/match/12345?enrich_lineup=true
```

### Frontend Component

The MatchLive component automatically requests enriched lineup data and displays it in the "Lineups" tab with:

1. **Formation Grid**: Visual cards showing players with images, jersey numbers, and positions
2. **Ratings List**: Fallback list view sorted by player ratings
3. **Responsive Design**: Adapts to different screen sizes

## Configuration

### Environment Variables

- `SPORTMONKS_API_KEY` - Required for fetching player details
- `SPORTMONKS_MAX_RETRIES` - API retry attempts (default: 8)
- `SPORTMONKS_BASE_BACKOFF_MS` - Retry backoff time (default: 500ms)

### Rate Limiting

The implementation includes built-in rate limiting for SportMonks API:

- Batch size: 3-5 players per batch (configurable)
- Delay between batches: 100-200ms (configurable)
- Automatic retry with exponential backoff

## Error Handling

- Graceful fallback to original lineup data if enrichment fails
- Player image fallback to initials if image unavailable
- Missing data handling (jersey numbers, positions, etc.)
- API rate limiting and timeout handling

## Performance Considerations

- Player data is fetched in batches to avoid API overload
- Images are lazy-loaded with fallback placeholders
- Enrichment is optional and only done when requested
- Caching considerations for frequently accessed player data (future enhancement)

## Future Enhancements

1. **True Formation Display**: Position players based on actual formation data (4-4-2, 3-5-2, etc.)
2. **Player Statistics**: Integration with season stats in player cards
3. **Player Caching**: Cache frequently accessed player data to reduce API calls
4. **Team Squad Management**: Ability to fetch and display full team squads
5. **Formation Comparison**: Side-by-side formation view for both teams

## Testing

A test script is available at `backend/test_player_enrichment.js` to verify the functionality:

```bash
cd backend
node test_player_enrichment.js
```

## Dependencies

- SportMonks API v3 (Football)
- Axios for HTTP requests
- MongoDB/Mongoose for data storage
- React for frontend components