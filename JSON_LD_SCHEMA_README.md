# Match Report JSON-LD Schema Example

This is an example of the JSON-LD schema that would be generated for a football match report by The Replay.

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
The JSON-LD schema is automatically generated and stored in the `json_ld_schema` field of each Report document. Frontend applications should insert this directly into the HTML head section of match report pages.