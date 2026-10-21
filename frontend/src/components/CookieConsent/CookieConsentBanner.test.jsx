import { act, fireEvent, render, screen } from '@testing-library/react';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { getCookieConsent, saveCookieConsent, OPEN_COOKIE_SETTINGS } from '../../utils/cookieUtils';
import CookieConsentBanner from './CookieConsentBanner';
import CookieSettingsButton from './CookieSettingsButton';
import CookieSettingsSection from './CookieSettingsSection';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }));
jest.mock('../../contexts/SubscriptionContext', () => ({ useSubscription: jest.fn() }));
jest.mock('../../contexts/AuthContext', () => ({ useAuth: jest.fn() }));

const showNotice = () => act(() => jest.advanceTimersByTime(2100));

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  jest.useFakeTimers();
  useAuth.mockReturnValue({ loading: false });
  useSubscription.mockReturnValue({ loading: false, hasActiveSubscription: false });
});
afterEach(() => jest.useRealTimers());

test('unpaid visitors get accept/pay only and dismissal is not consent', () => {
  const { container } = render(<><a href="/fixtures">Browse fixtures</a><CookieConsentBanner /><CookieSettingsButton /></>);
  showNotice();
  expect(screen.getByRole('button', { name: 'Accept All Cookies' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Pay for Ad-Free Access' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Reject|Manage Preferences/ })).not.toBeInTheDocument();
  expect(container.querySelector('.cookie-consent-backdrop')).toBeNull();
  expect(screen.getByRole('link', { name: 'Browse fixtures' })).toHaveAttribute('href', '/fixtures');
  fireEvent.click(screen.getByRole('button', { name: /Dismiss cookie notice/ }));
  expect(getCookieConsent()).toBeNull();
  expect(screen.queryByRole('region', { name: 'Cookie consent' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Cookie Settings/ }));
  expect(screen.getByRole('button', { name: 'Accept All Cookies' })).toBeInTheDocument();
});

test('pay opens existing plan selection without granting consent or blocking browsing', () => {
  render(<CookieConsentBanner />);
  showNotice();
  fireEvent.click(screen.getByRole('button', { name: 'Pay for Ad-Free Access' }));
  expect(mockNavigate).toHaveBeenCalledWith('/subscription/plans');
  expect(getCookieConsent()).toBeNull();
});

test('accept explicitly grants all optional categories', () => {
  render(<CookieConsentBanner />);
  showNotice();
  fireEvent.click(screen.getByRole('button', { name: 'Accept All Cookies' }));
  expect(getCookieConsent()).toMatchObject({ necessary: true, analytics: true, marketing: true, personalization: true });
  expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
});

test('paid visitors are also asked and may reject optional cookies', () => {
  useSubscription.mockReturnValue({ loading: false, hasActiveSubscription: true });
  render(<CookieConsentBanner />);
  showNotice();
  expect(screen.queryByRole('button', { name: 'Pay for Ad-Free Access' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Reject Optional Cookies' }));
  expect(getCookieConsent()).toMatchObject({ analytics: false, marketing: false, personalization: false, necessary: true });
});

test('paid visitors can save category-specific preferences', () => {
  useSubscription.mockReturnValue({ loading: false, hasActiveSubscription: true });
  render(<CookieConsentBanner />);
  showNotice();
  fireEvent.click(screen.getByRole('button', { name: 'Manage Preferences' }));
  fireEvent.click(screen.getByLabelText('Analytics Cookies'));
  fireEvent.click(screen.getByRole('button', { name: 'Save My Preferences' }));
  expect(getCookieConsent()).toMatchObject({ analytics: true, marketing: false, personalization: false });
});

test('a payment/status change never grants consent and preserves the paid choices', () => {
  const { rerender } = render(<CookieConsentBanner />);
  showNotice();
  fireEvent.click(screen.getByRole('button', { name: 'Pay for Ad-Free Access' }));
  useSubscription.mockReturnValue({ loading: false, hasActiveSubscription: true });
  rerender(<CookieConsentBanner />);
  showNotice();
  expect(getCookieConsent()).toBeNull();
  expect(screen.getByRole('button', { name: 'Manage Preferences' })).toBeInTheDocument();
});

test('existing consent is respected and reopening never clears it', () => {
  saveCookieConsent({ necessary: true, analytics: false, marketing: false, personalization: false });
  const stored = localStorage.getItem('tfp_cookie_consent');
  render(<><CookieConsentBanner /><CookieSettingsButton /></>);
  showNotice();
  expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: /Cookie Settings/ }));
  expect(localStorage.getItem('tfp_cookie_consent')).toBe(stored);
  expect(screen.queryByRole('button', { name: /Reject Optional/ })).toBeNull();
});

test('account settings use the same unpaid options rather than exposing a second editor', () => {
  render(<><CookieConsentBanner /><CookieSettingsSection /></>);
  fireEvent.click(screen.getByRole('button', { name: 'Manage' }));
  expect(screen.getByRole('button', { name: 'Pay for Ad-Free Access' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Save Preferences' })).toBeNull();
});

test('does not prompt crawlers, even when settings are requested', () => {
  const userAgent = jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (compatible; Googlebot/2.1)');
  render(<><CookieConsentBanner /><CookieSettingsButton /></>);
  showNotice();
  act(() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS)));
  expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
  expect(screen.queryByRole('button', { name: /Cookie Settings/ })).toBeNull();
  userAgent.mockRestore();
});

test('waits for subscription status before showing options', () => {
  useSubscription.mockReturnValue({ loading: true, hasActiveSubscription: false });
  const { rerender } = render(<CookieConsentBanner />);
  showNotice();
  expect(screen.queryByRole('region', { name: 'Cookie consent' })).toBeNull();
  useSubscription.mockReturnValue({ loading: false, hasActiveSubscription: true });
  rerender(<CookieConsentBanner />);
  showNotice();
  expect(screen.getByRole('button', { name: 'Reject Optional Cookies' })).toBeInTheDocument();
});
