/**
 * Utility functions for managing testing mode
 */

export const isTestingMode = () => {
  return process.env.REACT_APP_TESTING_MODE === 'true';
};

export const shouldDisableAnalytics = () => {
  return process.env.REACT_APP_DISABLE_ANALYTICS === 'true' || isTestingMode();
};

export const shouldDisableAdsense = () => {
  return process.env.REACT_APP_DISABLE_ADSENSE === 'true' || isTestingMode();
};

export const addNoIndexMetaTags = () => {
  if (isTestingMode()) {
    // Add runtime meta tags for extra protection
    const metaRobots = document.createElement('meta');
    metaRobots.name = 'robots';
    metaRobots.content = 'noindex, nofollow, noarchive, nosnippet, noimageindex';
    document.head.appendChild(metaRobots);

    const metaGooglebot = document.createElement('meta');
    metaGooglebot.name = 'googlebot';
    metaGooglebot.content = 'noindex, nofollow, noarchive, nosnippet, noimageindex';
    document.head.appendChild(metaGooglebot);
  }
};

export const getTestingModeStyles = () => {
  if (isTestingMode()) {
    return {
      paddingTop: '40px', // Account for testing banner
    };
  }
  return {};
};