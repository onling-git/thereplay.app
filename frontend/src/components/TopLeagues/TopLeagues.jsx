import React from "react";

import epllogo from "../../assets/images/epl-logo.svg";
import bundesligalogo from "../../assets/images/bundesliga-logo.svg";
import laligalogo from "../../assets/images/laliga-logo.svg";

import "./topleagues.css";

const TopLeagues = () => {
  return (
    <div>
      <div>
        <h2>Top Leagues</h2>
      </div>
      <div className="league-card-container">
        <div className="league-card">
          <p>Premier League</p>
          <img className="league-card-logo" src={epllogo} alt="" />
        </div>
        <div className="league-card">
          <p>La Liga</p>
          <img className="league-card-logo" src={laligalogo} alt="" />
        </div>
        <div className="league-card">
          <p>Bundesliga</p>
          <img className="league-card-logo" src={bundesligalogo} alt="" />
        </div>
        <div className="league-card">
          <p>Bundesliga</p>
          <img className="league-card-logo" src={bundesligalogo} alt="" />
        </div>
        <div className="league-card">
          <p>Bundesliga</p>
          <img className="league-card-logo" src={bundesligalogo} alt="" />
        </div>
        <div className="league-card">
          <p>Bundesliga</p>
          <img className="league-card-logo" src={bundesligalogo} alt="" />
        </div>
      </div>
    </div>
  );
};

export default TopLeagues;