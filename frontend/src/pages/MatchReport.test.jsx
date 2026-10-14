import { act, render, screen, waitFor } from '@testing-library/react';
import { useParams } from 'react-router-dom';
import MatchReport from './MatchReport';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn(),
  Link: ({ to, children }) => <a href={to}>{children}</a>,
}));
jest.mock('../api/base', () => ({ API_BASE: 'https://api.example.com' }));
jest.mock('../components/Breadcrumbs/Breadcrumbs', () => () => null);
jest.mock('../components/ReportContent', () => ({ report }) => <h1>{report?.generated?.headline}</h1>);

const originalFetch = global.fetch;
const payload = (teamSlug, matchId, headline) => ({
  match_id: Number(matchId),
  home_team: 'Southampton',
  away_team: 'Portsmouth',
  home_team_slug: 'southampton',
  report: { team_slug: teamSlug, match_id: Number(matchId), generated: { headline } },
});
const response = (data) => ({ ok: true, text: async () => JSON.stringify(data) });
const script = () => document.querySelector('script[type="application/ld+json"]');

beforeEach(() => {
  useParams.mockReturnValue({ teamSlug: 'portsmouth', matchId: '19729063' });
  global.fetch = jest.fn();
  jest.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test('loads the requested report and removes its schema when leaving', async () => {
  let resolve;
  global.fetch.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { unmount } = render(<MatchReport />);
  expect(script()).toBeNull();
  await act(async () => { resolve(response(payload('portsmouth', '19729063', 'Away report'))); });
  expect(await screen.findByRole('heading', { name: 'Away report' })).toBeInTheDocument();
  expect(JSON.parse(script().textContent)['@id']).toBe(
    'https://thereplay.app/portsmouth/match/19729063/report#article'
  );
  unmount();
  expect(script()).toBeNull();
});

test('navigation removes old schema and ignores an out-of-order response', async () => {
  let resolveAway;
  let resolveHome;
  let resolveOther;
  global.fetch
    .mockReturnValueOnce(new Promise((resolve) => { resolveAway = resolve; }))
    .mockReturnValueOnce(new Promise((resolve) => { resolveHome = resolve; }))
    .mockReturnValueOnce(new Promise((resolve) => { resolveOther = resolve; }));
  const { rerender } = render(<MatchReport />);
  useParams.mockReturnValue({ teamSlug: 'southampton', matchId: '19729063' });
  rerender(<MatchReport />);
  await act(async () => { resolveHome(response(payload('southampton', '19729063', 'Home report'))); });
  await act(async () => { resolveAway(response(payload('portsmouth', '19729063', 'Away report'))); });
  expect(JSON.parse(script().textContent).headline).toBe('Home report');

  useParams.mockReturnValue({ teamSlug: 'portsmouth', matchId: '19729064' });
  rerender(<MatchReport />);
  expect(script()).toBeNull();
  await act(async () => { resolveOther(response(payload('portsmouth', '19729064', 'Another report'))); });
  expect(JSON.parse(script().textContent)['@id']).toBe(
    'https://thereplay.app/portsmouth/match/19729064/report#article'
  );
  expect(document.querySelectorAll('script[type="application/ld+json"]')).toHaveLength(1);
});

test('failed navigation leaves no previous article schema', async () => {
  global.fetch.mockResolvedValueOnce(response(payload('portsmouth', '19729063', 'Away report')));
  const { rerender } = render(<MatchReport />);
  await waitFor(() => expect(script()).not.toBeNull());
  global.fetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => '{"error":"Report not available yet"}' });
  useParams.mockReturnValue({ teamSlug: 'portsmouth', matchId: '19729064' });
  rerender(<MatchReport />);
  expect(script()).toBeNull();
  expect(await screen.findByText('Report not available yet')).toBeInTheDocument();
  expect(script()).toBeNull();
});
