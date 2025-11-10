// src/config/adsense.js
export const ADSENSE_CONFIG = {
  // Replace with your actual Google AdSense client ID
  CLIENT_ID: "ca-pub-xxxxxxxxxxxxxxxxx",
  
  // Ad slot IDs - you'll get these from your AdSense dashboard
  AD_SLOTS: {
    HOME_HEADER: "1234567890",
    HOME_INLINE_1: "0987654321", 
    HOME_INLINE_2: "1122334455",
    HOME_FOOTER: "5544332211",
    TEAM_HEADER: "2345678901",
    TEAM_SIDEBAR: "3456789012",
    TEAM_INLINE: "4567890123",
    MATCH_HEADER: "5678901234",
    MATCH_INLINE: "6789012345",
    MATCH_FOOTER: "7890123456"
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