import React from "react";
import { Link } from "react-router-dom";

import logo from "../../assets/images/THEREPLAYLOGORECTANGLE.svg";
import AuthButtons from "../Auth/AuthButtons";

import "./header.css";

const Header = () => {
  return (
    <div>
      <div className="header">
        <Link to="/" className="header-logo-link">
          <img className="header-logo" src={logo} alt="The Final Play - Home" />
        </Link>
        {/* <select name="" id="">
          <option value="en">Football</option>
          
        </select> */}
        <AuthButtons />
      </div>

    </div>
  );
};

export default Header;
