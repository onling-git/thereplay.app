import React from "react";

import Header from "../components/Header/Header";
import FooterNav from "../components/FooterNav/FooterNav";
import TopLeagues from "../components/TopLeagues/TopLeagues";
import LiveScoreCards from "../components/LiveScoreCards/LiveScoreCards";
import TopStories from "../components/TopStories/TopStories";


import "./css/home.css";



const Home = () => {
  return (
    <div>
      <Header />
      <div className="home-content">
        <TopLeagues />
        <LiveScoreCards />
        <TopStories />
      </div>
      <FooterNav />
    </div>
  );
};

export default Home;
