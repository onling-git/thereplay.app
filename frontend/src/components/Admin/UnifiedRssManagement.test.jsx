import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import * as adminApi from '../../api/adminApi';
import UnifiedRssManagement from './UnifiedRssManagement';

jest.mock('../../api/adminApi', () => ({
  getAllTeams: jest.fn(),
  getRssFeeds: jest.fn(),
  createRssFeed: jest.fn(),
  deleteRssFeed: jest.fn(),
  updateRssFeed: jest.fn(),
  getTeamFeedSubscriptions: jest.fn(),
  addTeamFeedSubscription: jest.fn(),
  removeTeamFeedSubscription: jest.fn(),
}));

const team = { id: 'team-123', name: 'Arsenal', slug: 'arsenal' };
const feed = { id: 'feed-123', name: 'Arsenal News', url: 'https://example.com/rss', enabled: true };

beforeEach(() => {
  jest.clearAllMocks();
  adminApi.getAllTeams.mockResolvedValue({ teams: [team] });
  adminApi.getRssFeeds.mockResolvedValue({ feeds: [feed] });
  adminApi.getTeamFeedSubscriptions.mockResolvedValue({ subscriptions: [], pagination: { pages: 1 } });
  jest.spyOn(window, 'confirm').mockReturnValue(true);
});

afterEach(() => jest.restoreAllMocks());

test('deletes a generic feed using the ID returned by the API', async () => {
  adminApi.deleteRssFeed.mockResolvedValue({ success: true });
  render(<UnifiedRssManagement />);

  fireEvent.click(await screen.findByTitle('Expand generic feeds'));
  fireEvent.click(await screen.findByTitle('Delete feed'));

  await waitFor(() => expect(adminApi.deleteRssFeed).toHaveBeenCalledWith(feed.id));
});

test('creates and assigns a new team feed using the subscription API', async () => {
  adminApi.createRssFeed.mockResolvedValue({ feed });
  adminApi.addTeamFeedSubscription.mockResolvedValue({ success: true });
  render(<UnifiedRssManagement />);

  fireEvent.click(await screen.findByRole('button', { name: 'Edit RSS feeds for Arsenal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Feed' }));
  fireEvent.change(screen.getByPlaceholderText('Feed name'), { target: { value: 'New feed' } });
  fireEvent.change(screen.getByPlaceholderText('RSS Feed URL'), { target: { value: 'https://example.com/new-rss' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save feed for Arsenal' }));

  await waitFor(() => expect(adminApi.addTeamFeedSubscription).toHaveBeenCalledWith(team.id, feed.id));
  expect(adminApi.createRssFeed).toHaveBeenCalledWith(expect.objectContaining({ name: 'New feed', url: 'https://example.com/new-rss' }));
  expect(adminApi.createRssFeed.mock.calls[0][0]).not.toHaveProperty('team_id');
});

test('shows assigned feeds under their team rather than generic feeds', async () => {
  adminApi.getTeamFeedSubscriptions.mockResolvedValue({ subscriptions: [{ teamId: team.id, feeds: [{ feedId: feed.id }] }] });
  render(<UnifiedRssManagement />);

  const row = (await screen.findByText(team.name)).closest('tr');
  expect(within(row).getByText(feed.name)).toBeInTheDocument();
  fireEvent.click(screen.getByTitle('Expand generic feeds'));
  expect(screen.queryByTitle('Delete feed')).not.toBeInTheDocument();
});

test('assigns an existing generic feed without creating it again', async () => {
  adminApi.addTeamFeedSubscription.mockResolvedValue({ success: true });
  render(<UnifiedRssManagement />);

  fireEvent.click(await screen.findByRole('button', { name: 'Edit RSS feeds for Arsenal' }));
  fireEvent.change(screen.getByRole('combobox', { name: 'Assign existing feed to Arsenal' }), { target: { value: feed.id } });

  await waitFor(() => expect(adminApi.addTeamFeedSubscription).toHaveBeenCalledWith(team.id, feed.id));
  expect(adminApi.createRssFeed).not.toHaveBeenCalled();
});

test('removing a team feed unlinks it without deleting the shared feed', async () => {
  adminApi.getTeamFeedSubscriptions.mockResolvedValue({ subscriptions: [{ teamId: team.id, feeds: [{ feedId: feed.id }] }] });
  adminApi.removeTeamFeedSubscription.mockResolvedValue({ success: true });
  render(<UnifiedRssManagement />);

  fireEvent.click(await screen.findByRole('button', { name: 'Edit RSS feeds for Arsenal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Remove Arsenal News from Arsenal' }));

  await waitFor(() => expect(adminApi.removeTeamFeedSubscription).toHaveBeenCalledWith(team.id, feed.id));
  expect(adminApi.deleteRssFeed).not.toHaveBeenCalled();
});

test.each([true, false])('updates the enabled status from %p', async (enabled) => {
  adminApi.getRssFeeds
    .mockResolvedValueOnce({ feeds: [{ ...feed, enabled }] })
    .mockResolvedValue({ feeds: [{ ...feed, enabled: !enabled }] });
  adminApi.updateRssFeed.mockResolvedValue({ success: true });
  render(<UnifiedRssManagement />);

  fireEvent.click(await screen.findByTitle('Expand generic feeds'));
  fireEvent.click(screen.getByRole('switch', { name: 'Enable Arsenal News' }));

  await waitFor(() => expect(adminApi.updateRssFeed).toHaveBeenCalledWith(feed.id, { enabled: !enabled }));
  await waitFor(() => {
    const toggle = screen.getByRole('switch', { name: 'Enable Arsenal News' });
    expect(toggle).not.toBeDisabled();
    if (enabled) expect(toggle).not.toBeChecked();
    else expect(toggle).toBeChecked();
  });
});

test('loads all subscription pages, including teams beyond the first 100', async () => {
  adminApi.getTeamFeedSubscriptions.mockImplementation(({ page }) => Promise.resolve({
    subscriptions: page === 1 ? [] : [{ teamId: team.id, feeds: [{ feedId: feed.id }] }],
    pagination: { pages: 2 }
  }));
  render(<UnifiedRssManagement />);

  const row = (await screen.findByText(team.name)).closest('tr');
  expect(within(row).getByText(feed.name)).toBeInTheDocument();
  expect(adminApi.getTeamFeedSubscriptions).toHaveBeenCalledWith({ page: 2, limit: 100 });
});

test('shows the server error when saving fails', async () => {
  adminApi.createRssFeed.mockRejectedValue({ body: { error: 'Failed to create RSS feed', message: 'Database write denied' } });
  render(<UnifiedRssManagement />);

  fireEvent.click(await screen.findByTitle('Add Generic RSS Feed'));
  fireEvent.change(screen.getByPlaceholderText('Feed name'), { target: { value: 'New feed' } });
  fireEvent.change(screen.getByPlaceholderText('RSS Feed URL'), { target: { value: 'https://example.com/new-rss' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add Feed' }));

  expect(await screen.findByText('Database write denied')).toBeInTheDocument();
  expect(screen.getByPlaceholderText('Feed name')).toHaveValue('New feed');
});

test('retries a failed team assignment without creating duplicate feeds', async () => {
  const createdFeed = { ...feed, id: 'new-feed', name: 'New feed', url: 'https://example.com/new-rss' };
  adminApi.createRssFeed.mockResolvedValue({ feed: createdFeed });
  adminApi.addTeamFeedSubscription
    .mockRejectedValueOnce({ body: { error: 'Assignment failed' } })
    .mockResolvedValue({ success: true });
  render(<UnifiedRssManagement />);

  fireEvent.click(await screen.findByRole('button', { name: 'Edit RSS feeds for Arsenal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Add Feed' }));
  fireEvent.change(screen.getByPlaceholderText('Feed name'), { target: { value: createdFeed.name } });
  fireEvent.change(screen.getByPlaceholderText('RSS Feed URL'), { target: { value: createdFeed.url } });
  fireEvent.click(screen.getByRole('button', { name: 'Save feed for Arsenal' }));
  expect(await screen.findByText('Assignment failed')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Save feed for Arsenal' }));

  await waitFor(() => expect(adminApi.addTeamFeedSubscription).toHaveBeenCalledTimes(2));
  expect(adminApi.createRssFeed).toHaveBeenCalledTimes(1);
  expect(adminApi.addTeamFeedSubscription).toHaveBeenLastCalledWith(team.id, createdFeed.id);
});

test('does not delete a feed when confirmation is cancelled', async () => {
  window.confirm.mockReturnValue(false);
  render(<UnifiedRssManagement />);

  fireEvent.click(await screen.findByTitle('Expand generic feeds'));
  fireEvent.click(await screen.findByTitle('Delete feed'));

  expect(adminApi.deleteRssFeed).not.toHaveBeenCalled();
});