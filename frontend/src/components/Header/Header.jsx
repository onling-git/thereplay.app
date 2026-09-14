import React from "react";
import { Link } from "react-router-dom";

import logo from "../../assets/images/thereplay.app-logo.svg";
import AuthButtons from "../Auth/AuthButtons";
import TeamSearch from "../TeamSearch/TeamSearch";

import "./header.css";

const Header = () => {
  return (
    <div className="app-header">
      <Link to="/" className="header-logo-link">
        <img className="header-logo" src={logo} alt="The Final Play - Home" />
      </Link>
      <div className="header-nav-container">
        <ul className="header-nav">
          <li>
            <Link to="/about">About</Link>
          </li>
          <li>
            <Link to="/contact">Contact</Link>
          </li>
          <li>
            <Link to="/faq">FAQ</Link>
          </li>
          <li>
            <Link to="/blog">Blog</Link>
          </li>
        </ul>
      </div>
      <TeamSearch />
      <AuthButtons />
    </div>
  );
};

export default Header;
