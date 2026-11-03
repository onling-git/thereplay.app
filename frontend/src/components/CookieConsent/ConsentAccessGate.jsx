import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { COOKIE_CONSENT_CHANGED, getCookieConsent } from '../../utils/cookieUtils';
import { hasFreeAccessConsent, isConsentExemptPath } from '../../utils/consentAccess';
import { isCrawler } from '../../utils/isCrawler';
import CookieConsentBanner from './CookieConsentBanner';

export default function ConsentAccessGate({ children }) {
  const { pathname } = useLocation();
  const { loading: authLoading } = useAuth();
  const { hasActiveSubscription, loading, error, fetchSubscriptionStatus } = useSubscription();
  const [consent, setConsent] = useState(getCookieConsent);

  useEffect(() => {
    const update = () => setConsent(getCookieConsent());
    window.addEventListener(COOKIE_CONSENT_CHANGED, update);
    window.addEventListener('storage', update);
    const timer = setInterval(update, 60000);
    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGED, update);
      window.removeEventListener('storage', update);
      clearInterval(timer);
    };
  }, []);

  if (isConsentExemptPath(pathname) || isCrawler()) return children;
  if (authLoading || loading) return <p role="status">Checking access...</p>;
  if (hasActiveSubscription || hasFreeAccessConsent(consent)) return children;

  return (
    <>
      {error && (
        <div role="alert">
          <p>We could not check your subscription. You do not need to accept optional cookies if you have an active subscription.</p>
          <button type="button" onClick={fetchSubscriptionStatus}>Retry subscription check</button>
        </div>
      )}
      <CookieConsentBanner required />
    </>
  );
}
