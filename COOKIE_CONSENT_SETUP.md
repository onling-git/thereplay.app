# Cookie consent

## Behaviour

- Visitors without an active subscription see **Accept All Cookies** or **Pay for Ad-Free Access**. Pay opens the existing subscription plans page; it does not grant cookie consent.
- Subscribers without a saved choice are also asked, with **Accept**, **Reject Optional Cookies**, and **Manage Preferences**.
- The notice is non-modal: no backdrop or navigation gate. Close dismisses it without saving a choice. Visitors can browse without accepting or paying. With no saved choice, optional cookies remain denied.
- Existing valid choices are respected, including rejections. Consent expires after one year.
- The global Cookie Settings button is available to signed-in visitors and guests. It reopens the same banner without clearing consent. The account settings editor is available to subscribers; unpaid account settings open the same accept/pay notice.
- Known crawlers do not receive the notice, settings button or advertising scripts. User-agent detection is a presentation safeguard, not an authentication mechanism.
- Essential login/security/consent cookies remain necessary for everyone. An ad-free subscription is not a promise of a cookie-free site.

## Tracking and advertising

`frontend/src/utils/cookieUtils.js` persists choices and emits `cookie-consent-changed` so advertising visibility updates immediately. Opening settings uses `open-cookie-settings`.

Google Analytics loads only with analytics consent. Facebook Pixel and AdSense load only with marketing consent. Ad personalization additionally requires personalization consent. Subscribers receive no ads regardless of their optional cookie choices.

Do not add unconditional Google/Facebook advertising or analytics script tags to `frontend/public/index.html`; that bypasses consent checks. Keep the AdSense ownership verification meta tag.

Optional frontend environment variables:

```env
REACT_APP_GA_TRACKING_ID=your_google_analytics_id
REACT_APP_FB_PIXEL_ID=your_facebook_pixel_id
```

Consent withdrawal updates Google consent mode and Facebook consent, and removes rendered app ad slots. It cannot undo requests already made under previous consent or automatically remove every third-party cookie.

## Verification

Test fresh guest, signed-in unpaid, and subscriber sessions; acceptance, rejection, individual categories, reopening, dismissal, returning saved choices, payment without consent, and crawler user agents. Inspect network requests as well as the UI: there must be no AdSense request before marketing acceptance.

This documents application behaviour, not a legal compliance assessment. In particular, consent-or-pay wording and regional Google CMP requirements should be reviewed before relying on this as a compliance solution.
