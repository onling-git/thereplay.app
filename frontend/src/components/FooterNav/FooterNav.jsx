import React from "react";

import "./footernav.css";

import history from "../../assets/images/history.svg";
import favourite from "../../assets/images/favourite.svg";
import trending from "../../assets/images/trending.svg";
import account from "../../assets/images/account.svg";
import teamlogo from "../../assets/images/Southampton-Logo.png";

const FooterNav = () => {
  return (
    <div className="footer-nav">
      <div className="footer-content">
        <div className="icon-container">
          <img className="navbar-icon" src={favourite} alt="" />
          <p>favourites</p>
        </div>
        <div className="icon-container">
          <img className="navbar-icon" src={trending} alt="" />
          <p>trending</p>
        </div>

          <div className="team-logo-container">
            <img src={teamlogo} alt="" />
          </div>

        <div className="icon-container">
          <img className="navbar-icon" src={history} alt="" />
          <p>history</p>
        </div>
        <div className="icon-container">
          <img className="navbar-icon" src={account} alt="" />
          <p>account</p>
        </div>
      </div>
    </div>
  );
};

export default FooterNav;
