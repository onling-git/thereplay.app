# RSS Feed Management Improvements

## Summary of Changes

This document outlines the refinements made to the RSS Feed admin area to improve usability and functionality for managing football news feeds.

---

## 1. Auto-Generated Feed IDs

### What Changed
- **Before:** Users were required to manually enter a unique Feed ID when creating new RSS feeds
- **After:** Feed IDs are now automatically generated using the first 8 characters of a UUID (e.g., `a1b2c3d4`)

### Benefits
- Eliminates user error from duplicate or invalid IDs
- Reduces friction in the feed creation process
- Users no longer need to think about ID naming schemes

### Technical Details
- The model uses `v4: uuidv4` from the `uuid` package
- Short IDs (8 chars) are more readable than full UUIDs
- The ID field is optional in API requests; if not provided, it's auto-generated

---

## 2. Keyword Field Support

### What Changed
- **Before:** Keywords couldn't properly handle commas within values
- **After:** Keywords are now properly parsed as an array of comma-separated values

### How Keywords Work
Keywords serve as **content filters** to match articles from RSS feeds to specific topics or teams:

1. **Storage:** Keywords are stored as an array in the database
2. **Matching:** When articles are fetched from RSS feeds, the RSS aggregator searches article text (title, description, content) for any matching keywords
3. **Filtering:** Articles matching the feed's keywords are included; those that don't match are filtered out
4. **Case-insensitive:** All keyword matching is case-insensitive

### Example Use Cases
```
Feed: BBC Premier League
Keywords: ['premier league', 'southampton', 'saints', 'manchester city']

An article titled "Southampton 2-1 Manchester City - Match Report" would be matched
because it contains both 'southampton' and 'manchester city'
```

### Adding Keywords
- Enter keywords separated by commas: `premier league, southampton, saints`
- Each keyword is trimmed and converted to lowercase
- Empty keywords are automatically filtered out
- Whitespace before/after commas is handled automatically

---

## 3. Scope & Association Features

### New Fields

#### Scope
Determines how the feed is categorized:
- **`generic`** (default): Feed applies to all relevant content
- **`team`**: Feed is specific to certain teams
- **`league`**: Feed is specific to certain leagues  
- **`country`**: Feed is specific to certain countries

#### Teams (when scope = "team")
Associate this feed with specific teams by their ID or slug:
- Example: `southampton, manchester-city, liverpool`
- Used to serve team-specific news feeds

#### Leagues (when scope = "league")
Associate this feed with specific leagues by their ID:
- Example: `8, 9, 24` (Premier League, Championship, FA Cup)
- Used to serve league-specific news feeds

#### Countries (when scope = "country")
Associate this feed with specific countries by country code:
- Example: `gb, es, it` (Great Britain, Spain, Italy)
- Used to serve country-specific news feeds

### Why This Matters

**Smaller Teams & Targeted Coverage:**
Instead of getting news from generic football feeds, you can create dedicated feeds for smaller teams:

```
Feed: Southampton Official Channel
Scope: Team
Teams: southampton
URL: https://example.com/southampton-news/rss
```

This ensures that news specifically about Southampton is served to fans interested in that team, rather than diluting it with general Premier League news.

**Generic Option:**
The "generic" scope ensures that globally relevant feeds are always included, regardless of team/league filters.

### How to Use in Your Application

The backend provides query methods to retrieve relevant feeds:

```javascript
// Get feeds for a specific team
const teamFeeds = await RssFeed.findByTeam('southampton');

// Get feeds for a specific league
const leagueFeeds = await RssFeed.findByLeague(8);

// Get feeds for a specific country
const countryFeeds = await RssFeed.findByCountry('gb');
```

---

## Admin Interface Changes

### Creating a New Feed

1. **Click "Add RSS Feed"**
2. **Fill in required fields:**
   - Name (e.g., "BBC Football News")
   - URL (e.g., "http://feeds.bbci.co.uk/sport/football/rss.xml")

3. **Optional fields:**
   - Priority (1-100, higher = more important)
   - Keywords (comma-separated)
   - Description
   - Scope (and related team/league/country fields)

4. **Click "Create Feed"** - ID is generated automatically

### Editing a Feed

The Feed ID is **displayed but not editable** (read-only). All other fields can be modified:
- Update keywords to refine article matching
- Change scope and associations
- Adjust priority or enable/disable the feed

---

## Database Schema Changes

The `RssFeed` collection now includes:

```javascript
{
  _id: ObjectId,
  id: String,                    // Auto-generated short UUID
  name: String,
  url: String,
  enabled: Boolean,
  priority: Number,
  keywords: [String],            // Array of keywords
  description: String,
  scope: String,                 // 'generic' | 'team' | 'league' | 'country'
  teams: [String],               // Team IDs or slugs
  leagues: [Number],             // League IDs
  countries: [String],           // Country codes
  lastFetched: Date,
  lastSuccess: Date,
  lastError: String,
  articleCount: Number,
  fetchTimeout: Number,
  userAgent: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes Added
- `scope`: For quick filtering by feed type
- `teams`: For finding team-specific feeds
- `leagues`: For finding league-specific feeds
- `countries`: For finding country-specific feeds

---

## API Changes

### Create Feed (POST `/api/admin/rss/feeds`)

**Before:**
```javascript
{
  id: "bbc-football",  // Required
  name: "BBC Football",
  url: "...",
  keywords: ["football"],
  // ...
}
```

**After:**
```javascript
{
  // id is now optional - auto-generated if omitted
  name: "BBC Football",
  url: "...",
  keywords: ["football"],
  scope: "generic",           // New
  teams: [],                  // New
  leagues: [],                // New
  countries: [],              // New
  // ...
}
```

### Update Feed (PUT `/api/admin/rss/feeds/:feedId`)

Supports all the new fields in the request body:
- `scope`
- `teams`
- `leagues`
- `countries`

All responses now include these fields.

---

## Best Practices

### For Generic Feeds
Use generic scope for widely-relevant feeds:
```
- BBC Football (covers all leagues and teams)
- ESPN Soccer (broad coverage)
```

### For Team-Specific Feeds
Create dedicated feeds for smaller teams with limited coverage:
```
Feed: Southampton FC News
Scope: Team
Teams: southampton
Keywords: southampton, saints, fc, news
```

### For League-Specific Feeds
Group feeds by league:
```
Feed: Championship News Feed
Scope: League
Leagues: 9
Keywords: championship, efl, promotion
```

### For Country-Specific Feeds
Serve country-based news:
```
Feed: Spanish Football News
Scope: Country
Countries: es
Keywords: la liga, spanish, spain, futbol
```

---

## Migration Note

Existing feeds in your database will have:
- `scope: 'generic'` (default)
- `teams: []`
- `leagues: []`
- `countries: []`

No data loss occurs. You can update these fields as needed.

---

## Testing the Changes

1. **Create a feed without specifying an ID** - verify it's auto-generated
2. **Add keywords with commas** - verify they're parsed correctly
3. **Create a team-specific feed** - set scope to "team" and add team IDs
4. **View feed details** - confirm all new fields are displayed
5. **Test feed fetching** - use the test button to verify articles are fetched

---

## Troubleshooting

### Keywords not matching articles
- Check that keywords are lowercase (they're stored as lowercase)
- Ensure keywords appear in article title, description, or content
- Keywords use substring matching (e.g., "man" will match "manchester")

### Scope filters not working
- Make sure you're using the correct `findByTeam()`, `findByLeague()`, or `findByCountry()` methods
- Generic feeds always apply regardless of scope

### Auto-generated IDs not appearing
- Ensure `uuid` package is installed: `npm install uuid`
- Check server logs for any database errors

---

## Future Enhancements

Potential improvements to consider:
- Keyword validation and suggestions
- Team/League autocomplete selectors
- Feed priority presets (e.g., "Premium", "Standard")
- Scheduled feed testing/health checks
- Analytics on which feeds produce the most articles
