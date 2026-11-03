import React from 'react';
import { Link } from 'react-router-dom';
import LegalDocument from '../components/LegalDocument/LegalDocument';
import { OPEN_COOKIE_SETTINGS } from '../utils/cookieUtils';

export default function CookiePolicy() {
  return (
    <LegalDocument title="Cookie Policy">
      <section>
        <h2>Cookies and browser storage</h2>
        <p>The Replay uses cookies and similar technologies, including local storage, to run the site and remember choices. Some are essential; optional analytics, marketing and personalization technologies require consent.</p>
      </section>
      <section>
        <h2>Essential storage</h2>
        <ul>
          <li><strong>cookie_consent:</strong> a first-party cookie recording category choices, with a maximum age of one year.</li>
          <li><strong>tfp_cookie_consent:</strong> the local-storage record of your consent, version and choice date. The app asks again after a year or a consent-version change. The historical key name does not identify a separate service.</li>
          <li><strong>authToken:</strong> a local-storage login token used for authenticated requests. It is removed on logout; validity also depends on the token's expiry and account state.</li>
          <li>Other operational storage can remember account/subscription state and essential service preferences. Local storage does not necessarily expire automatically; you can clear it through your browser.</li>
        </ul>
        <p>Payment and security providers, including Stripe and Cloudflare, may use storage needed for payment processing, fraud prevention or service security when those features are used.</p>
      </section>
      <section>
        <h2>Optional categories and providers</h2>
        <ul>
          <li><strong>Google Tag Manager:</strong> container GTM-ML427NG8 manages configured tags and loads only after analytics consent. Analytics and advertising tags must also respect their respective consent categories.</li>
          <li><strong>Analytics:</strong> where configured, Google Analytics helps measure site usage. Its script is loaded only with analytics consent.</li>
          <li><strong>Marketing:</strong> Google AdSense supports advertising; a configured Meta Pixel can measure marketing events. Advertising requires marketing consent and is not shown to active subscribers.</li>
          <li><strong>Personalization:</strong> records permission for optional personalization and Google's ad-personalization consent signal.</li>
        </ul>
        <p>Provider cookie names and durations depend on the enabled service and your choices. Consult <a href="https://policies.google.com/technologies/cookies" target="_blank" rel="noreferrer">Google's cookie information</a>, <a href="https://www.facebook.com/privacy/policies/cookies/" target="_blank" rel="noreferrer">Meta's cookie policy</a> and <a href="https://stripe.com/legal/cookies-policy" target="_blank" rel="noreferrer">Stripe's cookie policy</a> for their current details.</p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>Optional categories are off until you explicitly consent. Access to football content requires either consent to analytics, marketing and personalization cookies or an active paid subscription. The free-access gate cannot be dismissed to bypass this choice. Policies, sign-in and account/subscription pages remain accessible without optional consent.</p>
        <p>Paying or creating an account does not grant consent. Active subscribers can access football content with all optional categories off and can reject or manage each category. Subscription prices and billing terms are shown on the plan and checkout pages.</p>
        <p>Open the cookie controls using the button below or the site's Cookie Settings button. Non-paying visitors can withdraw optional consent there; football access is then paused until they consent again or subscribe. You can also clear site cookies and local storage in your browser. This signs you out and resets saved browser preferences; paying subscribers need to sign in again to restore subscription access.</p>
        <button type="button" onClick={() => window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS))}>Open Cookie Settings</button>
        <p>Changes apply to future processing. Previously set third-party cookies may need to be removed through browser settings or the provider's controls; withdrawing consent cannot undo information already sent.</p>
        <p>Blocking essential storage may stop login or payment features working. More information about data use and rights is in our <Link to="/privacy-policy">Privacy Policy</Link>.</p>
      </section>
    </LegalDocument>
  );
}
