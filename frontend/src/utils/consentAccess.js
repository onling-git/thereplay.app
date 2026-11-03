export const hasFreeAccessConsent = consent => consent?.analytics === true
  && consent?.marketing === true && consent?.personalization === true;

export const isConsentExemptPath = pathname => [
  '/privacy-policy', '/cookie-policy', '/terms-of-service', '/attribution-copyright-policy'
].includes(pathname.replace(/\/$/, ''))
  || /^\/(account|subscription|admin)(\/|$)/.test(pathname);
