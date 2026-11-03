import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PrivacyPolicy from './PrivacyPolicy';
import CookiePolicy from './CookiePolicy';
import TermsOfService from './TermsOfService';
import AttributionCopyrightPolicy from './AttributionCopyrightPolicy';
import LegalLinks from '../components/LegalLinks/LegalLinks';
import { OPEN_COOKIE_SETTINGS } from '../utils/cookieUtils';

jest.mock('react-router-dom', () => ({
  Link: ({ to, children, ...props }) => <a href={to} {...props}>{children}</a>
}));
jest.mock('../components/Header/Header', () => () => <header>The Replay</header>);
jest.mock('../components/FooterNav/FooterNav', () => () => <footer />);

test.each([
  [PrivacyPolicy, 'Privacy Policy'],
  [CookiePolicy, 'Cookie Policy'],
  [TermsOfService, 'Terms of Service'],
  [AttributionCopyrightPolicy, 'Attribution & Copyright Policy']
])('renders a public policy with a fixed revision date and current contact', (Page, title) => {
  const { container } = render(<Page />);
  expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
  expect(screen.getByText('Last updated: 30 October 2026')).toBeInTheDocument();
  expect(screen.getAllByRole('link', { name: 'contact@thereplay.app' }).length).toBeGreaterThan(0);
  for (const link of screen.getAllByRole('link', { name: 'contact@thereplay.app' })) {
    expect(link).toHaveAttribute('href', 'mailto:contact@thereplay.app');
  }
  expect(container).not.toHaveTextContent(/the final play|thefinalplay\.com/i);
});

test('terms explicitly disclose automated reports and preserve statutory consumer rights', () => {
  render(<TermsOfService />);
  expect(screen.getByText('Reports are auto-generated and may contain errors.')).toBeInTheDocument();
  expect(screen.getByText(/not guaranteed to have been reviewed by a human/)).toBeInTheDocument();
  expect(screen.getByText(/statutory cancellation, refund or other consumer rights/)).toBeInTheDocument();
});

test('privacy covers social sources, both AI providers and the posting-date retention limit', () => {
  const { container } = render(<PrivacyPolicy />);
  expect(container).toHaveTextContent('twitterapi.io');
  expect(container).toHaveTextContent('OpenAI');
  expect(container).toHaveTextContent('Anthropic');
  expect(container).toHaveTextContent('30-day retention limit measured from the original post date');
  expect(screen.getByRole('link', { name: 'ico.org.uk' })).toHaveAttribute('href', 'https://ico.org.uk/make-a-complaint/');
});

test('cookie policy opens the existing settings without granting consent', () => {
  localStorage.clear();
  const open = jest.fn();
  window.addEventListener(OPEN_COOKIE_SETTINGS, open);
  try {
    render(<CookiePolicy />);
    fireEvent.click(screen.getByRole('button', { name: 'Open Cookie Settings' }));
    expect(open).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem('tfp_cookie_consent')).toBeNull();
    expect(screen.getByText(/free-access gate cannot be dismissed/)).toBeInTheDocument();
  } finally {
    window.removeEventListener(OPEN_COOKIE_SETTINGS, open);
  }
});

test('global policy navigation exposes all four policy routes', () => {
  render(<LegalLinks />);
  expect(screen.getByRole('navigation', { name: 'Policies' })).toBeInTheDocument();
  for (const [name, path] of [
    ['Privacy Policy', '/privacy-policy'],
    ['Cookie Policy', '/cookie-policy'],
    ['Terms of Service', '/terms-of-service'],
    ['Attribution & Copyright', '/attribution-copyright-policy']
  ]) {
    expect(screen.getByRole('link', { name })).toHaveAttribute('href', path);
  }
});
