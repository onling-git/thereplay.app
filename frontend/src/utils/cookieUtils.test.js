import {
  saveCookieConsent, clearCookieConsent, initializeTracking,
  initializeGoogleTagManager
} from './cookieUtils';
import { isCrawler } from './isCrawler';

jest.mock('./isCrawler', () => ({ isCrawler: jest.fn(() => false) }));

beforeEach(() => {
  localStorage.clear();
  document.querySelectorAll('script[data-replay-gtm]').forEach(script => script.remove());
  delete window.gtag;
  delete window.dataLayer;
  isCrawler.mockReturnValue(false);
});

afterEach(() => {
  localStorage.clear();
  document.querySelectorAll('script[data-replay-gtm]').forEach(script => script.remove());
  delete window.gtag;
  delete window.dataLayer;
  jest.restoreAllMocks();
});

const preferences = analytics => ({
  necessary: true, analytics, marketing: false, personalization: false
});

test('no GTM request before analytics consent, including marketing-only consent', () => {
  initializeTracking();
  initializeGoogleTagManager();
  saveCookieConsent({ ...preferences(false), marketing: true });
  expect(document.querySelector('script[data-replay-gtm]')).toBeNull();
});

test('analytics consent bootstraps the requested async container once with consent first', () => {
  saveCookieConsent(preferences(true));
  initializeTracking();
  initializeGoogleTagManager();
  const scripts = document.querySelectorAll('script[data-replay-gtm]');
  expect(scripts).toHaveLength(1);
  expect(scripts[0].src).toBe('https://www.googletagmanager.com/gtm.js?id=GTM-ML427NG8');
  expect(scripts[0].async).toBe(true);
  const entries = window.dataLayer;
  const bootstrap = entries.findIndex(entry => entry.event === 'gtm.js');
  expect(bootstrap).toBeGreaterThan(0);
  const defaults = entries.find(entry => entry[0] === 'consent' && entry[1] === 'default');
  expect(defaults[2].analytics_storage).toBe('denied');
  const update = entries.slice(0, bootstrap).find(entry => entry[0] === 'consent' && entry[1] === 'update');
  expect(update[2]).toMatchObject({ analytics_storage: 'granted', ad_storage: 'denied', ad_personalization: 'denied' });
  expect(entries.filter(entry => entry.event === 'gtm.js')).toHaveLength(1);
});

test('saved consent loads GTM on a return visit', () => {
  localStorage.setItem('tfp_cookie_consent', JSON.stringify({
    ...preferences(true), version: '1.0', timestamp: new Date().toISOString()
  }));
  initializeTracking();
  expect(document.querySelector('script[data-replay-gtm]')).not.toBeNull();
});

test('crawlers never load the container even with consent', () => {
  isCrawler.mockReturnValue(true);
  saveCookieConsent(preferences(true));
  initializeGoogleTagManager();
  expect(document.querySelector('script[data-replay-gtm]')).toBeNull();
});

test('withdrawal updates consent to denied without injecting a second container', () => {
  saveCookieConsent(preferences(true));
  clearCookieConsent();
  initializeTracking();
  const update = window.dataLayer.filter(entry => entry[0] === 'consent' && entry[1] === 'update').at(-1);
  expect(update[2]).toEqual({
    analytics_storage: 'denied', ad_storage: 'denied',
    ad_user_data: 'denied', ad_personalization: 'denied'
  });
  expect(document.querySelectorAll('script[data-replay-gtm]')).toHaveLength(1);
});

test('loader errors are logged', () => {
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  saveCookieConsent(preferences(true));
  document.querySelector('script[data-replay-gtm]').dispatchEvent(new Event('error'));
  expect(error).toHaveBeenCalledWith(expect.stringContaining('GTM-ML427NG8'));
});
