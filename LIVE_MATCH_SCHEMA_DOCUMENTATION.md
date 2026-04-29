# Live Match Schema.org Implementation

## Overview

The Final Play now includes comprehensive schema.org structured data for all live and completed sports events. This implementation follows the official schema.org/SportsEvent specification and provides rich, semantic markup that enhances SEO performance and enables rich search results.

## Features

### 🔴 Live Match Support
- **Real-time status detection**: Automatically detects live matches using match status and minute data
- **Current scores**: Displays live scores with `homeTeamScore` and `awayTeamScore` properties
- **Match duration**: Includes current match minute in ISO 8601 duration format (`PT67M`)
- **Live description**: Provides human-readable status like "Live: 2nd Half - 67'"

### ✅ Completed Match Support  
- **Final results**: Shows completed match scores and final status
- **Event history**: Includes all significant match events (goals, cards, substitutions)
- **Match summary**: Comprehensive post-match data for search engines

### ⏰ Scheduled Match Support
- **Future events**: Properly marks upcoming matches with `EventScheduled` status
- **Team information**: Includes participating teams and venue details
- **Competition context**: Links to parent competition/league

## Schema Structure

### Core Properties
```json
{
  "@type": "SportsEvent",
  "@id": "https://thefinalplay.com/team/match/id/live",
  "eventStatus": "https://schema.org/EventLive|EventCompleted|EventScheduled",
  "homeTeam": { "@type": "SportsTeam", "name": "Team Name" },
  "awayTeam": { "@type": "SportsTeam", "name": "Team Name" },
  "location": { "@type": "Place", "name": "Stadium Name" }
}
```

### Live Match Extensions
- `homeTeamScore` / `awayTeamScore`: Current match scores
- `duration`: Current match time in ISO format
- `description`: Live status description
- `subEvent[]`: Array of match events (goals, cards, etc.)

### Event Timeline
Each significant match event becomes a sub-event:
```json
{
  "@type": "SportsEvent", 
  "name": "GOAL: Player Name",
  "startDate": "2026-01-15T15:53:00.000Z",
  "description": "23' - GOAL by Player Name",
  "performer": { "@type": "Person", "name": "Player Name" }
}
```

## Technical Implementation

### Backend Components
1. **Schema Generator** (`utils/jsonLdSchema.js`)
   - `generateLiveMatchJsonLd()`: Main schema generation function
   - `isMatchLive()`: Live match detection logic
   - `isMatchCompleted()`: Completed match detection logic

2. **API Endpoint** (`/api/:team/match/:id/schema`)
   - Returns JSON-LD schema for specific matches
   - Includes generation timestamp and match URL
   - Handles error cases gracefully

3. **Route Integration** (`routes/matchRoutes.js`)
   - New schema endpoint added to existing match routes
   - Uses same validation middleware as other match endpoints

### Frontend Integration
1. **Automatic Injection** (`pages/MatchLive.jsx`)
   - Fetches schema when match data loads
   - Injects JSON-LD into document head
   - Cleans up schema on component unmount

2. **Dynamic Updates**
   - Schema refreshes when match data changes
   - Removes old schema before adding new one
   - Handles SSE updates for live matches

## SEO Benefits

### Search Engine Optimization
- **Rich Snippets**: Enables enhanced search results with scores, times, and teams
- **Live Results**: Real-time match data appears in Google Sports cards
- **Event Discovery**: Helps search engines understand match context and relationships

### Social Media Integration
- **Better Sharing**: Structured data improves social media link previews  
- **Sports Feeds**: Enables inclusion in automated sports news aggregators
- **Voice Search**: Optimized for voice assistants and smart displays

### Competition Context
- **League Integration**: Links matches to parent competitions
- **Team Relationships**: Connects matches to team profiles and histories
- **Venue Information**: Provides location context for local search

## Usage Examples

### Live Match
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SportsEvent",
  "eventStatus": "https://schema.org/EventLive",
  "homeTeamScore": 1,
  "awayTeamScore": 2, 
  "duration": "PT67M",
  "description": "Live: 2nd Half - 67'"
}
</script>
```

### Completed Match
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org", 
  "@type": "SportsEvent",
  "eventStatus": "https://schema.org/EventCompleted",
  "result": {
    "@type": "SportsEvent",
    "name": "Score: 1-2",
    "description": "Southampton FC 1-2 Arsenal"
  }
}
</script>
```

## Testing

Run the test suite to verify schema generation:
```bash
cd backend
node test_live_match_schema.js
```

The test validates:
- ✅ Live match detection and schema generation
- ✅ Completed match handling  
- ✅ Upcoming match scheduling
- ✅ Event timeline creation
- ✅ Proper status detection

## Validation

Validate generated schema using:
- [Google's Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)
- [JSON-LD Playground](https://json-ld.org/playground/)

## Best Practices

1. **Real-time Updates**: Schema updates automatically with live match data
2. **Error Handling**: Graceful degradation when schema generation fails
3. **Performance**: Schema generation is optimized for minimal overhead
4. **Cleanup**: Proper cleanup prevents memory leaks and duplicate schemas
5. **Validation**: All generated schema follows official schema.org standards

## Future Enhancements

- **Player Statistics**: Individual player performance data
- **Weather Conditions**: Match day weather information  
- **Attendance Figures**: Stadium capacity and attendance data
- **TV Broadcasting**: Television and streaming information
- **Betting Odds**: Live odds integration (where legally permitted)

This implementation positions The Final Play as a premium source for structured sports data, improving search visibility and enabling rich, interactive search experiences.