import React from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useFavoriteTeam } from "../../hooks/useFavoriteTeam";

import "./footernav.css";

import favourite from "../../assets/images/star-regular-full.svg";
import trending from "../../assets/images/fire-solid-full.svg";
import news from "../../assets/images/newspaper-regular-full.svg";
import teamlogo from "../../assets/images/Southampton-Logo.png";
import home from "../../assets/images/house-regular-full.svg";

// import {ReactComponent as History} from "../../assets/images/clock-rotate-left-solid-full.svg";

const FooterNav = () => {
  const location = useLocation();
  const { isAuthenticated } = useAuth();
  const { favoriteTeam, loading } = useFavoriteTeam();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="footer-nav">
      <div className="footer-content">

        <Link to="/trending" className={`footer-navbar-icon-container ${isActive('/trending') ? 'active' : ''}`}>
          <img className="footer-navbar-icon" src={trending} alt="" />
          <p>Trending</p>
        </Link>

        {/* Show user's favorite team if authenticated and has favorite, otherwise hide */}
        {isAuthenticated && favoriteTeam && !loading && (
          <Link 
            to={`/${favoriteTeam.slug}`} 
            className={`footer-navbar-icon-container ${isActive(`/${favoriteTeam.slug}`) ? 'active' : ''}`}
          >
            <img 
              className="footer-navbar-icon" 
              src={favoriteTeam.image_path || teamlogo} 
              alt={`${favoriteTeam.name} badge`}
              onError={(e) => {
                // Fallback to default team logo if favorite team image fails to load
                e.target.src = teamlogo;
              }}
            />
            <p>My Team</p>
          </Link>
        )}

        <Link to="/" className={`footer-navbar-icon-container ${isActive('/') ? 'active' : ''}`}>
          <img className="footer-navbar-icon" src={home} alt="Home" />
          <p>Home</p>
        </Link>

        <Link to="/followed-fixtures" className={`footer-navbar-icon-container ${isActive('/followed-fixtures') ? 'active' : ''}`}>
          <img className="footer-navbar-icon" src={favourite} alt="" />
          <p>Watchlist</p>
        </Link>

        <Link to="/news" className={`footer-navbar-icon-container ${isActive('/news') ? 'active' : ''}`}>
          <img className="footer-navbar-icon" src={news} alt="" />
          <p>News</p>
        </Link>
      </div>
    </div>
  );
};

export default FooterNav;
