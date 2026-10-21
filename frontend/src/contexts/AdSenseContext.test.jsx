import { act, render, screen } from '@testing-library/react';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { AdSenseProvider } from './AdSenseContext';
import AdSenseAd from '../components/AdSense/AdSenseAd';
import { saveCookieConsent, clearCookieConsent, getGoogleAnalyticsConsent } from '../utils/cookieUtils';

jest.mock('./AuthContext', () => ({ useAuth: jest.fn() }));
jest.mock('./SubscriptionContext', () => ({ useSubscription: jest.fn() }));

const allowMarketing = (personalization = true) => saveCookieConsent({ necessary: true, analytics: false, marketing: true, personalization });
const renderAds = () => render(<AdSenseProvider><AdSenseAd slot="5183171853" style={{ width: '728px' }} className="adsense-banner" /></AdSenseProvider>);

beforeEach(() => {
  jest.clearAllMocks();
  localStorage.clear();
  document.getElementById('replay-adsense')?.remove();
  delete window.adsbygoogle;
  delete window.gtag;
  delete window.dataLayer;
  useAuth.mockReturnValue({ isAuthenticated: false, loading: false });
  useSubscription.mockReturnValue({ hasActiveSubscription: false, hasFeatureAccess: () => false, loading: false });
  jest.useFakeTimers();
});
afterEach(() => jest.useRealTimers());

test('loads no advertising without consent and defaults to denial', () => {
  const { container } = renderAds();
  expect(container.querySelector('.adsbygoogle')).toBeNull();
  expect(document.getElementById('replay-adsense')).toBeNull();
  expect(getGoogleAnalyticsConsent()).toEqual({
    analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
  });
});

test('reacts to acceptance, waits for script readiness, bounds the responsive slot and removes it on revocation', () => {
  const { container, rerender } = renderAds();
  act(() => allowMarketing());
  const script = document.getElementById('replay-adsense');
  expect(script).not.toBeNull();
  const ad = container.querySelector('.adsbygoogle');
  expect(ad.style.width).toBe('100%');
  expect(ad.style.maxWidth).toBe('100%');
  expect(ad).toHaveAttribute('data-full-width-responsive', 'false');
  window.adsbygoogle = { push: jest.fn() };
  act(() => jest.advanceTimersByTime(1000));
  expect(window.adsbygoogle.push).not.toHaveBeenCalled();
  rerender(<AdSenseProvider><AdSenseAd slot="5183171853" /></AdSenseProvider>);
  expect(document.querySelectorAll('#replay-adsense')).toHaveLength(1);
  act(() => script.dispatchEvent(new Event('load')));
  act(() => jest.advanceTimersByTime(2100));
  expect(window.adsbygoogle.push).toHaveBeenCalledTimes(1);
  act(() => clearCookieConsent());
  expect(container.querySelector('.adsbygoogle')).toBeNull();
  expect(getGoogleAnalyticsConsent().ad_storage).toBe('denied');
});

test('marketing consent alone does not enable ad personalization', () => {
  allowMarketing(false);
  const { container } = renderAds();
  expect(container.querySelector('.adsbygoogle')).toHaveAttribute('data-npa', '1');
  expect(screen.getByText('Non-personalized ads')).toBeInTheDocument();
  expect(getGoogleAnalyticsConsent()).toMatchObject({ ad_storage: 'granted', ad_personalization: 'denied' });
});

test('personalization changes react immediately even when marketing consent stays enabled', () => {
  allowMarketing();
  const { container } = renderAds();
  expect(container.querySelector('.adsbygoogle')).not.toHaveAttribute('data-npa');
  act(() => allowMarketing(false));
  expect(container.querySelector('.adsbygoogle')).toHaveAttribute('data-npa', '1');
});

test('paid visitors see no advertising even if they consent', () => {
  allowMarketing();
  useSubscription.mockReturnValue({ hasActiveSubscription: true, hasFeatureAccess: () => true, loading: false });
  const { container } = renderAds();
  expect(container.querySelector('.adsbygoogle')).toBeNull();
  expect(document.getElementById('replay-adsense')).toBeNull();
});

test('crawlers load no advertising even with saved consent', () => {
  const userAgent = jest.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Googlebot/2.1');
  allowMarketing();
  renderAds();
  expect(document.getElementById('replay-adsense')).toBeNull();
  userAgent.mockRestore();
});
