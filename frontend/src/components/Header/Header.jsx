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
      <TeamSearch />
      <AuthButtons />
    </div>
  );
};

export default Header;
