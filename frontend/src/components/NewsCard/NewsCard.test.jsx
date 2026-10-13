import { render, screen } from '@testing-library/react';
import NewsCard from './NewsCard';

jest.mock('../../api', () => ({ getNewsForTeam: jest.fn() }));

const article = {
  id: 'team-story',
  title: 'Arsenal team news',
  summary: 'The latest Arsenal news.',
  source: 'BBC Sport',
  published_at: '2026-10-02T12:00:00Z',
  url: 'https://example.com/story',
  image_url: 'https://example.com/photo.jpg',
};

test('renders feed images with lazy loading and keeps article links', () => {
  render(<NewsCard articles={[article]} />);

  const image = screen.getByRole('img', { name: article.title });
  expect(image).toHaveAttribute('src', article.image_url);
  expect(image).toHaveAttribute('loading', 'lazy');
  expect(screen.getByRole('link', { name: article.title })).toHaveAttribute('href', article.url);
});

test.each([null, undefined, ''])('renders a decorative placeholder when the image URL is %p', (imageUrl) => {
  const { container } = render(<NewsCard articles={[{ ...article, image_url: imageUrl }]} />);

  expect(container.querySelector('.news-card-image')).toHaveAttribute('aria-hidden', 'true');
  expect(screen.queryByRole('img')).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: article.title })).toBeInTheDocument();
});

test('continues to respect the article limit', () => {
  render(<NewsCard articles={[article, { ...article, id: 'second-story', title: 'Second story' }]} maxArticles={1} />);

  expect(screen.getAllByRole('img')).toHaveLength(1);
  expect(screen.queryByRole('link', { name: 'Second story' })).not.toBeInTheDocument();
});

test.each([
  ['<p>The latest <strong>Arsenal</strong> news.</p>', 'The latest Arsenal news.'],
  ['<p>First paragraph.</p><p>Second &amp; third.</p>', 'First paragraph. Second & third.'],
  ['First<br />Second&nbsp;line', 'First Second line'],
  ['<script>alert("test")</script><style>p { color: red; }</style><p>News only.</p>', 'News only.'],
  [null, ''],
])('displays summary %p as plain text', (summary, expected) => {
  const { container } = render(<NewsCard articles={[{ ...article, summary }]} />);

  const intro = container.querySelector('.news-summary');
  expect(intro.textContent).toBe(`${expected}...`);
  expect(intro.children).toHaveLength(0);
});

test('strips markup before truncating the intro', () => {
  const text = 'Latest team news. '.repeat(10);
  const { container } = render(<NewsCard articles={[{ ...article, summary: `<p><strong>${text}</strong></p>` }]} />);

  expect(container.querySelector('.news-summary').textContent).toBe(`${text.trim().slice(0, 100)}...`);
});