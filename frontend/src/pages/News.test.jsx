import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { useSearchParams } from 'react-router-dom';
import { getNews, getNewsForLeague, getNewsForTeam, getNewsLeagues } from '../api';
import News from './News';

jest.mock('react-router-dom', () => ({
  useSearchParams: jest.fn(),
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>,
}));
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

beforeEach(() => {
  jest.clearAllMocks();
  useSearchParams.mockReturnValue([new URLSearchParams()]);
  getNews.mockResolvedValue([]);
  getNewsForLeague.mockResolvedValue([]);
  getNewsLeagues.mockResolvedValue([{ id: 'premier-league', displayName: 'Premier League' }]);
});

test.each([{ response: [article] }, { response: { data: [article] } }, { response: { articles: [article] } }])(
  'loads team news from the URL for response %p',
  async ({ response }) => {
    getNewsForTeam.mockResolvedValue(response);
    useSearchParams.mockReturnValue([new URLSearchParams('team=arsenal')]);
    const { rerender } = render(<News />);

    expect(await screen.findByText(article.title)).toBeInTheDocument();
    expect(getNewsForTeam).toHaveBeenCalledWith('arsenal');
    expect(getNews).not.toHaveBeenCalled();
    expect(getNewsForLeague).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Filter by League:')).not.toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'All football news' })).toHaveAttribute('href', '/news');
    useSearchParams.mockReturnValue([new URLSearchParams()]);
    rerender(<News />);
    expect(await screen.findByRole('heading', { name: 'Football News' })).toBeInTheDocument();
    expect(getNews).toHaveBeenCalledTimes(1);
  }
);

test('preserves all-news and league filtering without a team parameter', async () => {
  render(<News />);

  fireEvent.change(await screen.findByLabelText('Filter by League:'), { target: { value: 'premier-league' } });
  await waitFor(() => expect(getNewsForLeague).toHaveBeenCalledWith('premier-league'));
  expect(getNews).toHaveBeenCalledTimes(1);
  expect(getNewsForTeam).not.toHaveBeenCalled();
});