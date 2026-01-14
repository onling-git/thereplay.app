# NewsCard Component

A reusable component for displaying news articles in a card layout.

## Usage

```jsx
import NewsCard from "../components/NewsCard/NewsCard";

// Basic usage
<NewsCard articles={newsData} />

// With custom options
<NewsCard 
  articles={newsData} 
  maxArticles={6} 
  showViewMore={true} 
  viewMorePath="/news" 
/>
```

## Props

- `articles` (Array, required): Array of news article objects
- `maxArticles` (Number, default: 4): Maximum number of articles to display
- `showViewMore` (Boolean, default: false): Whether to show the "View All News" header and link
- `viewMorePath` (String, default: "/news"): Path for the "View All News" link

## Article Object Structure

Each article in the `articles` array should have:

```javascript
{
  id: unique identifier,
  title: "Article title",
  summary: "Article summary/description", 
  source: "News source name",
  published_at: "2023-12-04T10:00:00Z", // ISO date string
  url: "https://example.com/article" // External link to full article
}
```

## Example

```jsx
const newsData = [
  {
    id: 1,
    title: "Premier League Transfer Updates",
    summary: "Latest transfer news and rumors from the Premier League...",
    source: "BBC Sport",
    published_at: "2023-12-04T10:00:00Z",
    url: "https://www.bbc.com/sport/football/premier-league"
  }
  // ... more articles
];

return (
  <NewsCard 
    articles={newsData}
    maxArticles={4}
    showViewMore={true}
    viewMorePath="/news"
  />
);
```

This component is perfect for displaying news in sidebars, home page sections, or any page that needs a simple news card layout.