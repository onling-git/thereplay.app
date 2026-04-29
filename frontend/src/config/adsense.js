// src/config/adsense.js
export const ADSENSE_CONFIG = {
  // Your actual Google AdSense client ID
  CLIENT_ID: "ca-pub-8674391934466139",
  
  // Ad slot IDs from your AdSense dashboard
  AD_SLOTS: {
    HOME_HEADER: "5183171853",      // Home header display ad
    HOME_INLINE_1: "8038180302",    // Mid feed ad (home)
    HOME_INLINE_2: "8038180302",    // Mid feed ad (home) - reused
    HOME_FOOTER: "8038180302",      // Mid feed ad (home) - reused
    TEAM_HEADER: "5183171853",      // Home header display ad - reused
    TEAM_SIDEBAR: "3276027966",     // Sidebar display ad
    TEAM_INLINE: "8038180302",      // Mid feed ad - reused
    MATCH_HEADER: "5183171853",     // Home header display ad - reused
    MATCH_INLINE: "8038180302",     // Mid feed ad - reused
    MATCH_FOOTER: "8038180302"      // Mid feed ad - reused
  },

  // Ad formats and sizes
  AD_FORMATS: {
    BANNER: {
      format: "auto",
      responsive: true,
      className: "adsense-banner"
    },
    RECTANGLE: {
      format: "rectangle", 
      responsive: true,
      className: "adsense-medium-rectangle"
    },
    LARGE_RECTANGLE: {
      format: "rectangle",
      responsive: true, 
      className: "adsense-large-rectangle"
    },
    LEADERBOARD: {
      format: "auto",
      responsive: true,
      className: "adsense-leaderboard"
    }
  },

  // Environment settings
  ENABLED: process.env.NODE_ENV === 'production', // Only show ads in production
  TEST_MODE: process.env.REACT_APP_ADSENSE_TEST_MODE === 'true'
};