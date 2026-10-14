import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { getNews, getNewsForLeague, getNewsForTeam, getNewsLeagues } from '../api';
import News, { NewsRoute } from './News';

jest.mock('react-router-dom', () => {
  // CRA's Jest resolver cannot resolve React Router 7's /dom export.
  const { TextEncoder, TextDecoder } = require('util');
  Object.assign(global, { TextEncoder, TextDecoder });
  return jest.requireActual('react-router');
});

jest.mock('../api', () => ({
  getNews: jest.fn(),
  getNewsForLeague: jest.fn(),
  getNewsForTeam: jest.fn(),
  getNewsLeagues: jest.fn(),
}));
jest.mock('../components/AdSense', () => ({ AdSenseAd: () => null }));

const article = {
  id: 'team-story',
  title: 'Arsenal transfer news',
  url: 'https://example.com/story',
  published_at: '2026-10-01T12:00:00Z',
};

function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output aria-label="Current URL">{location.pathname}{location.search}{location.hash}</output>
    <Link to="/southampton/news">Southampton news</Link>
    <Link to="/news?team=arsenal">Old Arsenal link</Link>
    <button onClick={() => navigate(-1)}>Back</button>
  </>;
}

function renderNews(path = '/news', initialEntries = [path]) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Navigation />
      <Routes>
        <Route path="/news" element={<NewsRoute />} />
        <Route path="/:teamSlug/news" element={<News />} />
        <Route path="/previous" element={<h1>Previous page</h1>} />
      </Routes>
    </MemoryRouter>
  );
}

const schema = () => {
  const script = document.getElementById('news-structured-data');
  return script ? JSON.parse(script.textContent) : null;
};

beforeEach(() => {
  jest.clearAllMocks();
  getNews.mockResolvedValue([]);
  getNewsForTeam.mockResolvedValue([]);
  getNewsForLeague.mockResolvedValue([]);
  getNewsLeagues.mockResolvedValue([{ id: 'premier-league', displayName: 'Premier League' }]);
});

test.each([{ response: [article] }, { response: { data: [article] } }, { response: { articles: [article] } }])(
  'loads team news from the folder URL for response %p',
  async ({ response }) => {
    getNewsForTeam.mockResolvedValue(response);
    renderNews('/arsenal/news');

    expect(await screen.findByText(article.title)).toBeInTheDocument();
    expect(getNewsForTeam).toHaveBeenCalledWith('arsenal');
    expect(schema().url).toBe('https://thereplay.app/arsenal/news');
    expect(schema().about['@id']).toBe('https://thereplay.app/arsenal/');
    expect(schema().mainEntity.itemListElement).toEqual([
      { '@type': 'ListItem', position: 1, url: article.url },
    ]);
    expect(getNews).not.toHaveBeenCalled();
    expect(getNewsForLeague).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Filter by League:')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: 'All football news' }));
    expect(await screen.findByRole('heading', { name: 'Football News' })).toBeInTheDocument();
    expect(getNews).toHaveBeenCalledTimes(1);
    expect(schema().url).toBe('https://thereplay.app/news');
    expect(schema().about).toBeUndefined();
  }
);

test('preserves all-news and league filtering without a team parameter', async () => {
  renderNews();
  fireEvent.change(await screen.findByLabelText('Filter by League:'), { target: { value: 'premier-league' } });
  await waitFor(() => expect(getNewsForLeague).toHaveBeenCalledWith('premier-league'));
  expect(getNews).toHaveBeenCalledTimes(1);
  expect(getNewsForTeam).not.toHaveBeenCalled();
});

test('team reports appear in schema and use same-tab internal links while RSS links stay external', async () => {
  const report = {
    id: 'report-saints', kind: 'match-report', title: 'Saints win the derby',
    source: 'The Replay', summary: 'A narrow victory.',
    url: 'https://thereplay.app/southampton/match/19729063/report',
    published_at: '2026-10-11T15:00:00Z',
  };
  getNewsForTeam.mockResolvedValue([article, report]);
  renderNews('/southampton/news');
  const title = await screen.findByRole('link', { name: report.title });
  expect(title).toHaveAttribute('href', '/southampton/match/19729063/report');
  expect(title).not.toHaveAttribute('target');
  expect(screen.getAllByRole('link', { name: 'Read More →' })[0])
    .toHaveAttribute('href', '/southampton/match/19729063/report');
  expect(screen.getByRole('link', { name: article.title })).toHaveAttribute('target', '_blank');
  expect(schema().mainEntity.itemListElement).toEqual([
    { '@type': 'ListItem', position: 1, url: report.url },
    { '@type': 'ListItem', position: 2, url: article.url },
  ]);
});

test('legacy URLs redirect before fetching and retain other query parameters and fragments', async () => {
  renderNews('/news?team=arsenal&utm_source=bookmark#stories');
  expect(await screen.findByRole('heading', { name: 'arsenal News' })).toBeInTheDocument();
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/arsenal/news?utm_source=bookmark#stories');
  expect(getNewsForTeam).toHaveBeenCalledTimes(1);
  expect(getNewsForTeam).toHaveBeenCalledWith('arsenal');
  expect(getNews).not.toHaveBeenCalled();
});

test('client-side old links redirect with replacement rather than creating a back-button loop', async () => {
  renderNews('/previous');
  fireEvent.click(screen.getByRole('link', { name: 'Old Arsenal link' }));
  expect(await screen.findByRole('heading', { name: 'arsenal News' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect(await screen.findByRole('heading', { name: 'Previous page' })).toBeInTheDocument();
});

test('folder slug takes priority over a conflicting legacy query parameter', async () => {
  renderNews('/southampton/news?team=arsenal');
  expect(await screen.findByRole('heading', { name: 'southampton News' })).toBeInTheDocument();
  expect(getNewsForTeam).toHaveBeenCalledWith('southampton');
  expect(getNewsForTeam).not.toHaveBeenCalledWith('arsenal');
});

test('team navigation ignores a late response from the previous club', async () => {
  let resolveArsenal;
  getNewsForTeam.mockImplementation(slug => slug === 'arsenal'
    ? new Promise(resolve => { resolveArsenal = resolve; })
    : Promise.resolve([{ ...article, id: 'saints', title: 'Southampton story' }]));
  renderNews('/arsenal/news');
  fireEvent.click(screen.getByRole('link', { name: 'Southampton news' }));
  expect(await screen.findByText('Southampton story')).toBeInTheDocument();
  await act(async () => { resolveArsenal([article]); });
  expect(screen.queryByText(article.title)).not.toBeInTheDocument();
  expect(screen.getByText('Southampton story')).toBeInTheDocument();
  expect(schema().url).toBe('https://thereplay.app/southampton/news');
});

test('team API failures retain the team route and surface an error', async () => {
  const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
  getNewsForTeam.mockRejectedValue(new Error('offline'));
  renderNews('/arsenal/news');
  expect(await screen.findByText('Failed to load news')).toBeInTheDocument();
  expect(screen.getByLabelText('Current URL')).toHaveTextContent('/arsenal/news');
  expect(errorLog).toHaveBeenCalled();
  expect(schema()).toBeNull();
  errorLog.mockRestore();
});

test('initial server collection is reused so displayed links and schema cannot drift on startup', async () => {
  const snapshot = document.createElement('script');
  snapshot.id = 'news-initial-data';
  snapshot.type = 'application/json';
  snapshot.textContent = JSON.stringify({ pageUrl: 'https://thereplay.app/arsenal/news', articles: [article] });
  document.body.appendChild(snapshot);
  const { unmount } = renderNews('/arsenal/news');
  expect(await screen.findByText(article.title)).toBeInTheDocument();
  expect(getNewsForTeam).not.toHaveBeenCalled();
  expect(schema().mainEntity.numberOfItems).toBe(1);
  expect(document.getElementById('news-initial-data')).toBeNull();
  expect(document.querySelector('link[data-news-canonical]').href).toBe('https://thereplay.app/arsenal/news');
  unmount();
  expect(schema()).toBeNull();
  expect(document.querySelector('link[data-news-canonical]')).toBeNull();
});

test('league-filtered display updates schema without changing the general-news canonical', async () => {
  getNewsForLeague.mockResolvedValue([article]);
  renderNews();
  fireEvent.change(await screen.findByLabelText('Filter by League:'), { target: { value: 'premier-league' } });
  expect(await screen.findByText(article.title)).toBeInTheDocument();
  expect(schema().mainEntity.numberOfItems).toBe(1);
  expect(schema().url).toBe('https://thereplay.app/news');
});
