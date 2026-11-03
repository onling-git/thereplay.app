import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { saveCookieConsent, clearCookieConsent, getCookieConsent } from '../../utils/cookieUtils';
import ConsentAccessGate from './ConsentAccessGate';
import CookieConsentBanner from './CookieConsentBanner';
import CookieSettingsButton from './CookieSettingsButton';

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

test.each(['/privacy-policy', '/cookie-policy', '/terms-of-service', '/attribution-copyright-policy', '/privacy-policy/', '/account', '/account/subscription', '/subscription/plans', '/subscription/success', '/subscription/cancel'])('essential route %s is accessible without consent', path => {
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
