# JSON-LD Structured Data

## Team overview (implemented)

Team overview pages render one `application/ld+json` script with an `@graph`
after the team API response loads. The graph describes a [SportsTeam](https://schema.org/SportsTeam)
using the database `name`, the production team URL as `@id`, and `sport`.
The football catalog defaults to `Football`, including existing records without
the new field. Names are used as stored; no `FC` suffix is automatically added.

The [Team model](backend/models/Team.js) now includes `sport` and `sameAs`.
The existing `GET /api/teams/:teamSlug` endpoint returns these fields along with
the team document. No extra Sportmonks request is needed. Catalog syncs update
provider fields without overwriting these manually maintained fields.

`sameAs` defaults to an empty array and is omitted from JSON-LD until populated.
To add identity links later, set the team's `sameAs` array in MongoDB to absolute
HTTP/HTTPS URLs that identify that exact team (for example Wikidata and Wikipedia).
Mongoose validates these URLs on document saves; updates should use
`runValidators: true`. No admin editing UI or database backfill is required.

Example output once those URLs are populated:

The team node below is included in the graph alongside the WebPage and optional
next-match SportsEvent nodes.

```json
{
  "@context": "https://schema.org",
  "@type": "SportsTeam",
  "@id": "https://thereplay.app/southampton/",
  "name": "Southampton FC",
  "sport": "Football",
  "sameAs": [
    "https://www.wikidata.org/wiki/Q10487",
    "https://en.wikipedia.org/wiki/Southampton_F.C."
  ]
}
```

The script is client-rendered, updates on team navigation, and is removed while
loading, on errors, or when leaving the overview. It is not embedded in the static
HTML template. Existing testing-phase `noindex` directives remain unchanged;
structured data alone does not enable indexing or guarantee a rich result.

### Hub WebPage and next-match SportsEvent

The graph also defines `https://thereplay.app/:teamSlug#webpage`, with the hub
URL, `isPartOf` referencing `https://thereplay.app/#website`, `about` referencing
the existing SportsTeam ID, and `provider` referencing
`https://thereplay.app/#organization`. Website and organization details are
defined inline so these references are not left unexplained.

When the Next Match card has a fixture ID, known opponent, home/away orientation,
and valid kickoff, the graph includes a SportsEvent. The WebPage links to it with
`mentions`. The schema uses the same normalized snapshot/resolved fixture as the
card; no additional API calls or database fields are required.

- `name`, `homeTeam` and `awayTeam` respect the home/away orientation.
- `startDate` is the stored kickoff serialized as ISO 8601 UTC, not browser-local
  time. Missing or invalid kickoff data does not produce an event.
- Team IDs retain `https://thereplay.app/:teamSlug/`, rather than introducing
  incompatible `#team` identities. Opponents without stored slugs are described
  by name without fabricating a URL.
- Event IDs retain the home team's
  `https://thereplay.app/:homeTeamSlug/match/:matchId#event`, matching report
  references. Both hubs identify the same fixture when the home slug is known;
  old away snapshots missing the opponent slug fall back to the current hub slug.
- Known scheduled, cancelled, and postponed provider statuses map to
  `EventScheduled`, `EventCancelled`, and `EventPostponed`. Unknown, live, finished,
  or unsupported statuses do not invent an `eventStatus`.
- A missing next match leaves WebPage/SportsTeam markup intact. Navigation
  removes old event data and ignores late fixture responses for a previous team.

This SportsEvent describes the card's fixture; the live-match page owns its
canonical event node. Known fixture venues are linked using the shared Place
identity, independently of the team's home stadium. No attendance mode or ticket information is
invented, and this does not guarantee Google event rich-result eligibility.

## Match reports (implemented)

Match report pages render [NewsArticle](https://schema.org/NewsArticle) JSON-LD
from the report returned by `GET /api/:teamSlug/match/:matchId/report`. This
works for existing and newly generated reports without regeneration or backfill.
The frontend does not insert the historical stored `json_ld`/`json_ld_schema`
strings, which used an old domain and are not fields in the current Report model.

- Each article's `@id` is
  `https://thereplay.app/:teamSlug/match/:matchId/report#article`.
  Both the team perspective and match ID are part of the identity; regeneration
  updates the same article, while opposing-team reports have distinct IDs.
- `url` and `mainEntityOfPage` use the corresponding production report URL.
- `headline` uses `generated.headline`, falling back to the top-level headline.
  `description` uses the first nonblank summary paragraph.
- `datePublished` uses the stored `createdAt`; `dateModified` uses `updatedAt`
  (or `createdAt` if unavailable). Dates are serialized in ISO 8601 UTC. Match
  kickoff and page-load time are never substituted for publication timestamps.
- `image` uses the Report model's optional `images` array of real HTTP/HTTPS image
  URLs. Populate this array when report images are available; it defaults to `[]`
  and is omitted until then. Team badges are not substituted for article images.
- Author/publisher share `https://thereplay.app/#organization`; the author defines
  the organization inline. `isPartOf` defines `https://thereplay.app/#website`.
- `about` references the home team's production canonical match URL with `#event`,
  using the home slug now exposed by the report API. Old matches without that
  slug fall back to the requested team's match URL.
- The team reference uses `https://thereplay.app/:teamSlug/`, matching the
  SportsTeam ID already emitted on team overview pages (not a separate `#team`).

Legacy string reports use the visible match report title and first paragraph,
omitting timestamps and images that were never stored. No schema is emitted for
missing reports or structured reports without a headline. Loading, failed
requests, stale responses, route changes, and unmounting cannot leave another
report's schema attached to the page. Stored text is escaped for safe insertion.

As with the overview, markup is client-rendered and testing-phase `noindex`
directives are unchanged. Structured data does not guarantee a rich result.

## Canonical match / live page (implemented)

The home team's `https://thereplay.app/:homeTeamSlug/match/:matchId` owns the
SportsEvent. The existing `/:teamSlug/match/:matchId/live` route remains supported,
and both team perspectives emit a canonical link and graph pointing to the home
match URL. Report and hub references now use this URL's `#event` rather than
`/live#event`. Team IDs remain `https://thereplay.app/:teamSlug/` everywhere.

The existing `GET /api/:teamSlug/match/:matchId/schema` endpoint now returns:

- `graph`: the structured JSON-LD graph (WebPage, SportsEvent, optional LiveBlogPosting).
- `schema`: safely serialized script markup for compatibility.
- `matchUrl`: the canonical home-team match URL.

The server regenerates the graph during single-fixture live refresh, live-now
sync, finished-match stats refresh, and schema requests. Scheduled, postponed,
and cancelled provider states map to valid schema.org EventStatusType values.
Live/finished phases omit `eventStatus`; invalid `EventLive` and `EventCompleted`
enumerations are not emitted.

LiveBlogPosting includes goals (including own goals and penalties), cards, and
substitutions from the stored event stream, not commentary lines. Updates are
deduplicated, exclude rescinded events, follow provider `sort_order`, and retain
the most recent 40 key events if a fixture exceeds that size. Each update has a
stable fixture-specific ID.

Full Sportmonks `periods` are now persisted, including `started`, `ended`, and
`counts_from`, alongside `detailedPeriods` for separate extra-time halves.
Minute-resolution update timestamps are derived from the matching
period's actual start plus elapsed match minutes and added time, accounting for
halftime. They are not second-accurate event timestamps. If period timing is
unavailable, `datePublished` is omitted rather than inferred from kickoff.
Second-half extra-time timestamps require a detailed period to avoid ignoring
the extra-time interval. Fixture normalization now rejects missing/invalid
kickoffs instead of storing the current time or interpreting a null timestamp
as the Unix epoch.
Coverage starts at the first stored period start; a finished match's coverage
ends at the last recorded period end. No artificial pre-match coverage window
is created.

Once the server first generates a finished match's graph, it persists that final
graph in `Match.structured_data`, with `structured_data_frozen_at`. Further
requests return the frozen graph without rebuilding it or changing its dates.
Persistence uses a version-checked atomic update, so an obsolete live request
cannot overwrite a newer/final snapshot. Historical finished matches freeze
on their first schema request; sync existing matches first if venue or period
data needs enriching before freezing. For an intentional post-match correction,
clear both structured-data fields after correcting the fixture to regenerate it.

### Isolation from match reports and ratings

Structured-data persistence updates only `structured_data` and
`structured_data_frozen_at`, with Mongoose timestamps disabled. The liveblog's
40-entry limit applies only to JSON-LD; it does not truncate stored match events,
comments, lineups, statistics, or ratings used by reports.

Match sync persists the provider venue snapshot without requiring the venue
registry to succeed. A subsequent schema/venue-registry failure is explicitly
logged but does not interrupt core match persistence, sync counts, or the
existing automatic report-generation trigger. The schema endpoint still fails
explicitly if it cannot produce its graph and retries generation on later requests.

Finished-match stats requests retain their original include fallbacks if the new
venue/detailed-period includes are rejected. Single-fixture and team-window sync
retry core includes on provider 400/403/422 responses. If a partial finished-match
stats response omits kickoff, normalization uses that match's stored kickoff;
new fixtures still require a valid provider kickoff, never the current time.

Offline regression coverage in `backend/test_schema_report_regressions.js`
exercises normalization, actual finished-match sync, both team-perspective
scoring/POTM dossiers, schema failures, and provider-include fallbacks.
Finished-match sync converts the loaded Mongoose document to a plain object before
merging lineups, preserving player identity and ratings in both grouped and flat
lineup shapes.

### Initial HTML and deployment

Cloudflare Pages middleware inserts the backend-generated graph and canonical
link into the initial match HTML, including `/live` aliases. The server renderer
uses the Pages `API_BASE` or `REACT_APP_API_BASE` environment variable when set,
otherwise the same production/staging Railway origins used by the client.
Set `API_BASE` in Pages when using a different backend.

Deploy both the backend and frontend/Pages Functions together: the new renderer
requires the endpoint's `graph` response. `npm start` is still a client-rendered
CRA development server; server HTML injection runs on Cloudflare Pages, not CRA.
Server HTML and the schema endpoint use `Cache-Control: no-store` so phase changes
are not hidden by caches. Missing matches return 404; schema-service failures
return 503 rather than a success-shaped stale match page.

Client-side SSE refreshes fetch the server's graph, replace a real JSON-LD script,
and keep the canonical link in sync. Initial server markup is retained while the
client loads; obsolete responses and route/unmount/error cleanup are handled.
Testing-phase `noindex` directives are unchanged.

### Venue collection and team hub

Fixture sync already collected some Sportmonks venue data. Sync now retains
full venue address/city/country fields and maps each provider ID into a `Venue`
document with an immutable `slug`, used for `/venues/:slug#place`. Slugs include
the numeric provider ID to distinguish same-named stadiums. Provider renames
update the venue name without changing its identity. These are entity identifiers;
this change does not add public venue pages.

Team catalog sync includes the team's `venue` and stores `venue_id` plus a venue
snapshot. Existing teams load their provider-designated home venue on the first
hub API request and cache it in MongoDB; it is not guessed from an away/neutral
fixture. Failures are logged and exposed as `venue_error` on the team response.
The hub displays the home stadium name and links its SportsTeam to that Place.
The next-match event uses the fixture's venue, which may differ from the home
stadium. Real country codes are used when supplied or resolved from the stored
Country catalog; `GB` is never assumed for all fixtures.

## Historical backend schema example (not current page output)

The example below documents the older backend utility, not the implemented
match report page schema. Its old domain, placeholder images, and extra fields
must not be copied into current pages.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "NewsArticle",
  "headline": "Saints secure hard-fought victory against Palace",
  "image": [
    {
      "@type": "ImageObject",
      "url": "https://thefinalplay.com/assets/teams/southampton-logo.png",
      "width": 1200,
      "height": 675
    },
    {
      "@type": "ImageObject",
      "url": "https://thefinalplay.com/assets/default-match-image.jpg",
      "width": 1200,
      "height": 675
    }
  ],
  "datePublished": "2026-01-13T15:30:00Z",
  "dateModified": "2026-01-13T15:30:00Z",
  "author": {
    "@type": "Organization",
    "name": "The Replay",
    "url": "https://thefinalplay.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://thefinalplay.com/assets/logo.png",
      "width": 600,
      "height": 200
    }
  },
  "publisher": {
    "@type": "Organization",
    "name": "The Replay",
    "url": "https://thefinalplay.com",
    "logo": {
      "@type": "ImageObject",
      "url": "https://thefinalplay.com/assets/logo.png",
      "width": 600,
      "height": 200
    }
  },
  "articleBody": "Southampton secured a crucial 2-1 victory over Crystal Palace at St. Mary's Stadium...",
  "articleSection": "Sports",
  "mainEntityOfPage": {
    "@type": "WebPage",
    "@id": "https://thefinalplay.com/reports/southampton/19615693"
  },
  "keywords": "Southampton, Crystal Palace, Premier League, match report, football, soccer",
  "about": {
    "@type": "SportsEvent",
    "name": "Southampton vs Crystal Palace",
    "startDate": "2026-01-13T15:00:00Z",
    "location": {
      "@type": "Place",
      "name": "St. Mary's Stadium",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Southampton",
        "addressCountry": "GB"
      }
    },
    "homeTeam": {
      "@type": "SportsTeam",
      "name": "Southampton"
    },
    "awayTeam": {
      "@type": "SportsTeam",
      "name": "Crystal Palace"
    },
    "sport": "Football",
    "competitor": [
      {
        "@type": "SportsTeam",
        "name": "Southampton"
      },
      {
        "@type": "SportsTeam",
        "name": "Crystal Palace"
      }
    ],
    "result": {
      "@type": "SportsEvent",
      "name": "Final Score: 2-1",
      "description": "Southampton 2-1 Crystal Palace"
    },
    "referee": {
      "@type": "Person",
      "name": "Michael Oliver"
    },
    "superEvent": {
      "@type": "SportsEvent",
      "name": "Premier League"
    },
    "subEvent": [
      {
        "@type": "SportsEvent",
        "name": "goal: Adam Armstrong",
        "startDate": "2026-01-13T15:23:00Z",
        "description": "23' - goal by Adam Armstrong"
      },
      {
        "@type": "SportsEvent",
        "name": "goal: Che Adams",
        "startDate": "2026-01-13T16:12:00Z",
        "description": "72' - goal by Che Adams"
      },
      {
        "@type": "SportsEvent",
        "name": "yellowcard: James Ward-Prowse",
        "startDate": "2026-01-13T16:15:00Z",
        "description": "75' - yellowcard by James Ward-Prowse"
      }
    ]
  },
  "breadcrumb": {
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://thefinalplay.com"
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Match Reports",
        "item": "https://thefinalplay.com/reports"
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": "Saints secure hard-fought victory against Palace",
        "item": "https://thefinalplay.com/reports/southampton/19615693"
      }
    ]
  }
}
</script>
```

## Key Features

### Google News & Search Optimization
- **NewsArticle** schema with proper author and publisher markup
- **SportsEvent** structured data for rich sports results
- Breadcrumb navigation for better site structure
- Proper image dimensions (1200x675px) for social sharing

### SEO Benefits
- Rich snippets in search results
- Enhanced visibility in Google News
- Better understanding of content by search engines
- Structured match data for sports-specific features

### Technical Implementation
- Generated automatically with each match report
- Uses ISO 8601 timestamps throughout
- Includes match events as sub-events with proper timing
- Handles both existing and new report generation
- Properly escaped JSON for HTML insertion

### Usage
The historical backend utility attempted to store generated schema strings.
Current pages instead generate their markup from the current report data as
described above; do not insert those historical strings into the page.