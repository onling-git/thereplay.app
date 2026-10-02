import React from "react";
import { Link } from "react-router-dom";
import { useFavoriteTeam } from "../../hooks/useFavoriteTeam";

import AuthButtons from "../Auth/AuthButtons";
import TeamSearch from "../TeamSearch/TeamSearch";

import "./header.css";

const Header = () => {
  const { favoriteTeam, loading } = useFavoriteTeam();

  return (
    <div className="app-header">
      <Link to="/" className="header-logo-link">
        <img className="header-logo" src="https://imagedelivery.net/IyOC7uTDWFgfD5VgVJbU5A/2bc06d98-6612-4ec0-b597-165d3af9cc00/public" alt="The Final Play - Home" />
      </Link>
      <div className="header-nav-container">
        <ul className="header-nav">
          <li>
            <Link to="/followed-fixtures">My Matches</Link>
          </li>
          <li>
            <Link to="/fixtures">Fixtures</Link>
          </li>
          <li>
            <Link to="/news">News</Link>
          </li>
          {!loading && favoriteTeam?.slug && (
            <li>
              <Link to={`/${favoriteTeam.slug}`}>My team</Link>
            </li>
          )}
        </ul>
      </div>
      <div className="header-right">
        <TeamSearch />
        <AuthButtons />
      </div>



    </div>
  );
};

export default Header;
