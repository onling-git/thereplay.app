import React from "react";
import { Link } from 'react-router-dom';

import logo from '../../assets/images/thefinalplaylogo.svg';
import AuthButtons from '../Auth/AuthButtons';

import './header.css';

const Header = () => {
  return (
    <div className="header">
        <Link to="/" className="header-logo-link">
          <img className="header-logo" src={logo} alt="The Final Play - Home" />
        </Link>
        <AuthButtons />
    </div>
  )
};

export default Header;
