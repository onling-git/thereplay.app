export const isCrawler = () =>
  typeof navigator !== 'undefined' &&
  /bot\b|crawler|spider|slurp|bingpreview|facebookexternalhit|mediapartners-google|adsbot-google|google-inspectiontool/i.test(navigator.userAgent);
