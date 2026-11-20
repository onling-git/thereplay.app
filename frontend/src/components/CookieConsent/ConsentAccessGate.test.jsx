import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { saveCookieConsent, clearCookieConsent, getCookieConsent } from '../../utils/cookieUtils';
import ConsentAccessGate from './ConsentAccessGate';
import CookieConsentBanner from './CookieConsentBanner';
import CookieSettingsButton from './CookieSettingsButton';
import TeamDirectory from '../../pages/TeamDirectory';
import { TeamDirectoryContent } from '../TeamDirectoryContent.mjs';
import { TeamHubSummary } from '../TeamHubSummary.mjs';
import TeamHubSummarySlot from '../TeamHubSummarySlot';
import { hydrateTeamHubIsland } from '../teamHubIsland';
import { hydrateRoot } from 'react-dom/client';

let mockPath = '/fixtures';
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPath }),
  useNavigate: () => mockNavigate
}));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: jest.fn() }));

const all = { necessary: true, analytics: true, marketing: true, personalization: true };
const paid = { loading: false, hasActiveSubscription: true };
const mount = () => render(
  <>
    <ConsentAccessGate><div>Football content</div></ConsentAccessGate>
    <CookieConsentBanner />
    <CookieSettingsButton />
  </>
);

test('initial team snapshot hydrates hidden and the matching content stays gated', async () => {
  const { renderToString } = require('react-dom/server');
  const data = {
    team: { name: 'Southampton', slug: 'southampton', story: 'Club history', venue: "St Mary's" },
    recent: [], upcoming: [],
  };
  const snapshot = <TeamHubSummary data={data} slug="southampton" />;
  const style = document.createElement('style');
  style.textContent = 'html.team-hub-js #team-hub-depot{display:none}';
  document.head.appendChild(style);
  const depot = document.createElement('main');
  depot.id = 'team-hub-depot';
  depot.innerHTML = `<h1>Southampton</h1><div id="team-hub-island">${renderToString(snapshot)}</div>`;
  document.body.appendChild(depot);
  const bootstrap = document.createElement('script');
  bootstrap.id = 'team-hub-initial-data';
  bootstrap.type = 'application/json';
  bootstrap.textContent = JSON.stringify({ data, slug: 'southampton' });
  document.body.appendChild(bootstrap);
  document.documentElement.classList.add('team-hub-js');
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  let dispose;
  try {
    await act(async () => {
      dispose = hydrateTeamHubIsland();
    });
    expect(depot).not.toBeVisible();
    mockPath = '/southampton';
    const { unmount, rerender } = render(<ConsentAccessGate><TeamHubSummarySlot summary={data} slug="southampton" /></ConsentAccessGate>);
    expect(screen.getByRole('region', { name: 'Cookie consent' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Southampton overview' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Accept All Cookies' }));
    expect(screen.getByRole('heading', { name: 'Southampton overview' })).toBeVisible();
    expect(screen.getByText('Club history')).toBeVisible();
    expect(document.querySelectorAll('#team-hub-island')).toHaveLength(1);
    const updated = { ...data, team: { ...data.team, story: 'Updated history' } };
    rerender(<ConsentAccessGate><TeamHubSummarySlot summary={updated} slug="southampton" /></ConsentAccessGate>);
    await waitFor(() => expect(screen.getByText('Updated history')).toBeVisible());
    rerender(<ConsentAccessGate><TeamHubSummarySlot summary={null} slug="arsenal" /></ConsentAccessGate>);
    expect(depot.querySelector('#team-hub-island')).not.toBeNull();
    expect(screen.queryByRole('heading', { name: 'Southampton overview' })).toBeNull();
    expect(error).not.toHaveBeenCalled();
    unmount();
  } finally {
    if (dispose) await act(async () => dispose());
    depot.remove();
    bootstrap.remove();
    style.remove();
    document.documentElement.classList.remove('team-hub-js');
    error.mockRestore();
  }
});

beforeEach(() => {
  localStorage.clear();
  document.querySelectorAll('script[data-replay-gtm]').forEach(script => script.remove());
  jest.clearAllMocks();
  mockPath = '/fixtures';
  useAuth.mockReturnValue({ loading: false });
  useSubscription.mockReturnValue({ loading: false, hasActiveSubscription: false });
});

test('non-paying access is blocked immediately and has no dismiss/bypass control', () => {
  mount();
  expect(screen.queryByText('Football content')).toBeNull();
  expect(screen.getAllByRole('region', { name: 'Cookie consent' })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: /Dismiss/ })).toBeNull();
  expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy-policy');
  fireEvent.click(screen.getByRole('button', { name: 'Pay for Ad-Free Access' }));
  expect(mockNavigate).toHaveBeenCalledWith('/subscription/plans');
  expect(getCookieConsent()).toBeNull();
  expect(screen.queryByText('Football content')).toBeNull();
});

test('blocked football components are not mounted or allowed to start data requests', () => {
  const mounted = jest.fn();
  function FootballPage() {
    React.useEffect(mounted, []);
    return <div>Football content</div>;
  }
  render(<ConsentAccessGate><FootballPage /></ConsentAccessGate>);
  expect(mounted).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Accept All Cookies' }));
  expect(mounted).toHaveBeenCalledTimes(1);
});

test('saved full consent grants access without another prompt', () => {
  saveCookieConsent(all);
  mount();
  expect(screen.getByText('Football content')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
});

test.each(['/', '/news', '/arsenal', '/arsenal/news', '/followed-fixtures', '/league/8/fixtures', '/arsenal/match/123/live', '/arsenal/match/123/report', '/arsenal/community'])('football route %s is gated', path => {
  mockPath = path;
  mount();
  expect(screen.queryByText('Football content')).toBeNull();
});

test.each(['/teams', '/teams/', '/privacy-policy', '/cookie-policy', '/terms-of-service', '/attribution-copyright-policy', '/privacy-policy/', '/account', '/account/subscription', '/subscription/plans', '/subscription/success', '/subscription/cancel'])('essential route %s is accessible without consent', path => {
  mockPath = path;
  mount();
  expect(screen.getByText('Football content')).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
});

test('accepting all grants access; withdrawal immediately unmounts content and sends denied consent', () => {
  mount();
  fireEvent.click(screen.getByRole('button', { name: 'Accept All Cookies' }));
  expect(screen.getByText('Football content')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Cookie Settings/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Withdraw Optional Cookie Consent' }));
  expect(screen.queryByText('Football content')).toBeNull();
  expect(getCookieConsent()).toBeNull();
});

test.each(['analytics', 'marketing', 'personalization'])('previous consent lacking %s does not grant free access', category => {
  saveCookieConsent({ ...all, [category]: false });
  mount();
  expect(screen.queryByText('Football content')).toBeNull();
});

test('subscribers can browse and reject every optional category without losing access', () => {
  useSubscription.mockReturnValue(paid);
  mount();
  expect(screen.getByText('Football content')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Cookie Settings/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Reject Optional Cookies' }));
  expect(getCookieConsent()).toMatchObject({ analytics: false, marketing: false, personalization: false });
  expect(screen.getByText('Football content')).toBeInTheDocument();
});

test('starting or ending a subscription changes access without changing cookie choices', () => {
  const { rerender } = render(<ConsentAccessGate><div>Football content</div></ConsentAccessGate>);
  useSubscription.mockReturnValue(paid);
  rerender(<ConsentAccessGate><div>Football content</div></ConsentAccessGate>);
  expect(screen.getByText('Football content')).toBeInTheDocument();
  expect(getCookieConsent()).toBeNull();
  useSubscription.mockReturnValue({ ...paid, hasActiveSubscription: false });
  rerender(<ConsentAccessGate><div>Football content</div></ConsentAccessGate>);
  expect(screen.queryByText('Football content')).toBeNull();
});

test('waits for access checks and explicitly surfaces subscription failures with retry', () => {
  useSubscription.mockReturnValue({ loading: true, hasActiveSubscription: false });
  const { rerender } = render(<ConsentAccessGate><div>Football content</div></ConsentAccessGate>);
  expect(screen.getByRole('status')).toHaveTextContent('Checking access');
  const retry = jest.fn();
  useSubscription.mockReturnValue({ loading: false, hasActiveSubscription: false, error: 'Unavailable', fetchSubscriptionStatus: retry });
  rerender(<ConsentAccessGate><div>Football content</div></ConsentAccessGate>);
  expect(screen.getByRole('alert')).toHaveTextContent('could not check your subscription');
  fireEvent.click(screen.getByRole('button', { name: 'Retry subscription check' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

test('cross-tab withdrawal updates the gate', () => {
  saveCookieConsent(all);
  mount();
  expect(screen.getByText('Football content')).toBeInTheDocument();
  act(() => {
    localStorage.clear();
    window.dispatchEvent(new Event('storage'));
  });
  expect(screen.queryByText('Football content')).toBeNull();
});

test('existing crawler access is preserved for initial public content', () => {
  const userAgent = jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (compatible; Googlebot/2.1)');
  try {
    mount();
    expect(screen.getByText('Football content')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
  } finally {
    userAgent.mockRestore();
  }
});

test('expired consent reopens the gate even while a page remains open', () => {
  jest.useFakeTimers();
  try {
    saveCookieConsent(all);
    mount();
    const consent = getCookieConsent();
    localStorage.setItem('tfp_cookie_consent', JSON.stringify({ ...consent, timestamp: '2020-01-01T00:00:00Z' }));
    act(() => jest.advanceTimersByTime(60000));
    expect(screen.queryByText('Football content')).toBeNull();
  } finally {
    jest.useRealTimers();
    act(() => clearCookieConsent());
  }
});

test('server-rendered directory hydrates and remains accessible without consent', async () => {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
  const { renderToString } = require('react-dom/server.edge');
  const teams = [{ id: 1, name: 'Southampton', slug: 'southampton' }];
  const depot = document.createElement('div');
  depot.id = 'team-directory-depot';
  depot.innerHTML = `<div id="team-directory-island">${renderToString(<TeamDirectoryContent teams={teams} />)}</div>`;
  document.body.appendChild(depot);
  const island = depot.firstElementChild;
  const recoverable = jest.fn();
  let root;
  try {
    await act(async () => {
      root = hydrateRoot(island, <TeamDirectoryContent teams={teams} />, { onRecoverableError: recoverable });
    });
    mockPath = '/teams';
    const { unmount } = render(<ConsentAccessGate><TeamDirectory /></ConsentAccessGate>);
    expect(island.hidden).toBe(false);
    expect(screen.getByRole('link', { name: 'Southampton' })).toHaveAttribute('href', '/southampton');
    expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
    expect(recoverable).not.toHaveBeenCalled();
    unmount();
  } finally {
    if (root) await act(async () => root.unmount());
    depot.remove();
  }
});
