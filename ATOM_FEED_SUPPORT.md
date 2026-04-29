# Atom Feed Support Documentation

## Overview

The application now supports both **RSS** and **Atom** feed formats. The feed aggregator automatically detects the feed type and parses it accordingly.

## Supported Feed Types

| Feed Type | Format | Detection |
|-----------|--------|-----------|
| **RSS 2.0** | `<rss><channel><item>` | Auto-detected |
| **RSS 1.0** | `<rdf:RDF><item>` | Auto-detected |
| **Atom** | `<feed><entry>` | Auto-detected |

## Key Features

### 1. Automatic Feed Type Detection

The system automatically detects whether a feed is RSS or Atom based on its XML structure:

```javascript
// RSS 2.0: result?.rss?.channel?.item
// Atom:    result?.feed?.entry
// RSS 1.0: result?.['rdf:RDF']?.item
```

No manual configuration is required - just add the feed URL and the system handles the rest.

### 2. Feed Type Configuration (Optional)

You can optionally specify the feed type in the database:

```javascript
{
  name: 'Example Atom Feed',
  url: 'https://example.com/feed.atom',
  feedType: 'auto' // Options: 'rss', 'atom', 'auto' (default)
}
```

- `auto`: Automatically detect the feed type (recommended)
- `rss`: Force RSS parsing
- `atom`: Force Atom parsing

### 3. Atom-Specific Parsing

Atom feeds have different field names than RSS. The system maps them correctly:

| Field | RSS | Atom |
|-------|-----|------|
| **Title** | `<title>` | `<title>` |
| **Content** | `<description>` | `<content>` or `<summary>` |
| **Link** | `<link>` | `<link rel="alternate">` |
| **Date** | `<pubDate>` | `<updated>` or `<published>` |
| **Image** | `<enclosure>` | `<media:thumbnail>` or image link |

### 4. Updated Accept Headers

HTTP requests now accept both RSS and Atom formats:

```javascript
'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml'
```

## Database Schema Changes

### RssFeed Model

Added `feedType` field to track feed format:

```javascript
feedType: {
  type: String,
  enum: ['rss', 'atom', 'auto'],
  default: 'auto',
  lowercase: true
}
```

This field is **optional** - if not specified, the system defaults to `'auto'` and detects the format automatically.

## Implementation Details

### Parser Functions

Two dedicated parser functions handle the different formats:

1. **`parseRssItem(item, feed, index)`** - Parses RSS items
   - Extracts: `link`, `guid`, `description`, `pubDate`, `enclosure`
   - Handles RSS-specific URL formats

2. **`parseAtomEntry(entry, feed, index)`** - Parses Atom entries
   - Extracts: `link[rel="alternate"]`, `content`, `summary`, `updated`, `published`
   - Handles Atom link arrays with multiple relations
   - Supports media:thumbnail for images

### Main Feed Fetcher

The `fetchRssFeed()` function now:
1. Fetches the feed XML
2. Parses it with `xml2js`
3. Detects the feed type (RSS vs Atom)
4. Routes to appropriate parser
5. Returns normalized articles

## Usage Examples

### Adding an RSS Feed

```javascript
const rssFeed = {
  name: 'BBC Football',
  url: 'http://feeds.bbci.co.uk/sport/football/rss.xml',
  enabled: true,
  priority: 1,
  feedType: 'auto' // or 'rss'
};
```

### Adding an Atom Feed

```javascript
const atomFeed = {
  name: 'Reddit Soccer',
  url: 'https://www.reddit.com/r/soccer/.rss',
  enabled: true,
  priority: 1,
  feedType: 'auto' // or 'atom'
};
```

### Both Feed Types Work Identically

```javascript
const { aggregateFeeds } = require('./utils/rssAggregator');

// Fetch from all feeds (RSS and Atom)
const articles = await aggregateFeeds({
  leagueId: 8, // Premier League
  limit: 20
});

// Articles are normalized regardless of source format
articles.forEach(article => {
  console.log(article.title);    // Works for both RSS and Atom
  console.log(article.summary);  // Normalized from description/content
  console.log(article.url);      // Extracted from link/guid
  console.log(article.published_at); // Normalized date
});
```

## Testing

Test the implementation with the provided test script:

```bash
node scripts/testAtomFeedSupport.js
```

This will:
- Fetch a sample RSS feed
- Fetch a sample Atom feed
- Display parsed results for comparison
- Verify both formats work correctly

## Popular Atom Feeds for Football

Here are some example Atom feeds you can add:

```javascript
// Reddit Soccer (Atom)
{
  name: 'Reddit r/soccer',
  url: 'https://www.reddit.com/r/soccer/.rss',
  feedType: 'auto'
}

// Note: Most major football news sources use RSS 2.0
// Atom is more common in blogs and modern platforms
```

## Backward Compatibility

✅ All existing RSS feeds continue to work without modification
✅ No database migration required - `feedType` has a default value
✅ Feed configuration files don't need updates

## Benefits

1. **Flexibility** - Support feeds from any platform (RSS or Atom)
2. **Future-proof** - Ready for modern Atom-based sources
3. **Automatic** - No manual configuration needed
4. **Unified** - Both formats output the same article structure

## Technical Notes

### Feed Detection Logic

```javascript
if (result?.rss?.channel?.item) {
  // RSS 2.0 detected
} else if (result?.feed?.entry) {
  // Atom detected
} else if (result?.['rdf:RDF']?.item) {
  // RSS 1.0 detected
}
```

### Atom Link Extraction

Atom feeds can have multiple links with different relations:

```xml
<entry>
  <link rel="alternate" type="text/html" href="https://example.com/article"/>
  <link rel="self" href="https://example.com/feed/123"/>
</entry>
```

The parser prioritizes `rel="alternate"` links for article URLs.

## Module Exports

New exported functions:

```javascript
module.exports = {
  // ... existing exports
  parseAtomEntry,  // Parse single Atom entry
  parseRssItem,    // Parse single RSS item
};
```

## Development Notes

- All feed parsing is handled in `utils/rssAggregator.js`
- Database model updated in `models/RssFeed.js`
- Test script available at `scripts/testAtomFeedSupport.js`

---

**Last Updated**: April 6, 2026
**Version**: 2.0
