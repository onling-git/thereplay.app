import { render } from '@testing-library/react';
import NewsStructuredData from './NewsStructuredData';

const collection = { articles: [{ url: 'https://example.com/story' }], total: 1 };
const script = () => document.getElementById('news-structured-data');

test('general and team collections differ only by their page identity and team reference', () => {
  const { rerender, unmount } = render(<NewsStructuredData collection={collection} />);
  const general = JSON.parse(script().textContent);
  expect(general.about).toBeUndefined();
  expect(general.url).toBe('https://thereplay.app/news');
  rerender(<NewsStructuredData collection={collection} teamSlug="portsmouth" />);
  const team = JSON.parse(script().textContent);
  expect(team.mainEntity).toEqual(general.mainEntity);
  expect(team.isPartOf).toEqual(general.isPartOf);
  expect(team.about).toEqual({ '@id': 'https://thereplay.app/portsmouth/' });
  expect(team.url).toBe('https://thereplay.app/portsmouth/news');
  expect(document.querySelectorAll('#news-structured-data')).toHaveLength(1);
  unmount();
  expect(script()).toBeNull();
  expect(document.querySelector('link[data-news-canonical]')).toBeNull();
});

test('loading or failed navigation removes the previous collection and canonical', () => {
  const { rerender } = render(<NewsStructuredData teamSlug="southampton" collection={collection} />);
  rerender(<NewsStructuredData teamSlug="arsenal" pending />);
  expect(script()).toBeNull();
  expect(document.querySelector('link[data-news-canonical]')).toBeNull();
  rerender(<NewsStructuredData teamSlug="arsenal" collection={null} />);
  expect(script()).toBeNull();
});

test('initial server markup is retained while loading the same route, then replaced without duplicates', () => {
  const initial = document.createElement('script');
  initial.id = 'news-structured-data';
  initial.type = 'application/ld+json';
  initial.setAttribute('data-page-url', 'https://thereplay.app/southampton/news');
  initial.textContent = '{"server":true}';
  document.head.appendChild(initial);
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.setAttribute('data-news-canonical', '');
  document.head.appendChild(canonical);
  const { rerender } = render(<NewsStructuredData teamSlug="southampton" pending />);
  expect(script()).toBe(initial);
  rerender(<NewsStructuredData teamSlug="southampton" collection={collection} />);
  expect(JSON.parse(script().textContent)['@type']).toBe('CollectionPage');
  expect(document.querySelectorAll('#news-structured-data')).toHaveLength(1);
  expect(document.querySelectorAll('link[data-news-canonical]')).toHaveLength(1);
});

test('server markup is removed when the initial load fails', () => {
  const initial = document.createElement('script');
  initial.id = 'news-structured-data';
  initial.type = 'application/ld+json';
  initial.setAttribute('data-page-url', 'https://thereplay.app/news');
  document.head.appendChild(initial);
  const { rerender } = render(<NewsStructuredData pending />);
  expect(script()).toBe(initial);
  rerender(<NewsStructuredData collection={null} />);
  expect(script()).toBeNull();
});
