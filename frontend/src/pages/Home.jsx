import React from "react";

import Header from "../components/Header/Header";
import FooterNav from "../components/FooterNav/FooterNav";
import TopLeagues from "../components/TopLeagues/TopLeagues";
import LiveScoreCards from "../components/LiveScoreCards/LiveScoreCards";
import TopStories from "../components/TopStories/TopStories";
import { AdSenseAd, PremiumBanner } from "../components/AdSense";

import "./css/home.css";



const Home = () => {
  return (
    <div>
      <Header />
      <div className="home-content">
        {/* Header Ad */}
        <AdSenseAd 
          slot="1234567890" // Replace with your actual ad slot ID
          format="rectangle"
          className="adsense-header adsense-large-rectangle"
        />
        <PremiumBanner />
        
        <TopLeagues />
        
        {/* Inline Ad between sections */}
        <AdSenseAd 
          slot="0987654321" // Replace with your actual ad slot ID
          format="auto"
          className="adsense-inline adsense-banner"
        />
        
        <LiveScoreCards />
        
        {/* Another inline ad */}
        <AdSenseAd 
          slot="1122334455" // Replace with your actual ad slot ID
          format="rectangle"
          className="adsense-inline adsense-medium-rectangle"
        />
        
        <TopStories />
        
        {/* Footer Ad */}
        <AdSenseAd 
          slot="5544332211" // Replace with your actual ad slot ID
          format="auto"
          className="adsense-footer adsense-leaderboard"
        />
      </div>
      <FooterNav />
    </div>
  );
};

export default Home;
