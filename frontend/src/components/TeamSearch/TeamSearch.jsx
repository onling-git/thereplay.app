import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getTeams } from "../../api";
import searchIcon from "../../assets/images/magnifying-glass-solid-full.svg";
import "./TeamSearch.css";

const TeamSearch = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [teams, setTeams] = useState([]);
  const [filteredTeams, setFilteredTeams] = useState([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch teams on mount
  useEffect(() => {
    const fetchTeams = async () => {
      setLoading(true);
      try {
        const response = await getTeams({ limit: 5000 });
        // API returns { teams: [...] }, not a direct array
        const teamsArray = response?.teams || [];
        setTeams(teamsArray);
        console.log("[TeamSearch] Loaded teams:", teamsArray.length);
      } catch (error) {
        console.error("Failed to fetch teams:", error);
        setTeams([]);
      } finally {
        setLoading(false);
      }
    };

    fetchTeams();
  }, []);

  // Filter teams based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTeams([]);
      setShowSuggestions(false);
      return;
    }

    // Defensive check to ensure teams is an array
    if (!Array.isArray(teams) || teams.length === 0) {
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = teams
      .filter((team) => team.name && team.name.toLowerCase().includes(query))
      .slice(0, 8); // Limit to 8 suggestions

    setFilteredTeams(filtered);
    setShowSuggestions(true); // Always show dropdown when typing, even if no results
  }, [searchQuery, teams]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
        // On mobile, also collapse the search
        if (window.innerWidth <= 768) {
          setIsExpanded(false);
          setSearchQuery("");
        }
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle team selection
  const handleTeamClick = (team) => {
    navigate(`/${team.slug}`);
    setSearchQuery("");
    setShowSuggestions(false);
    setIsExpanded(false);
  };

  // Handle search icon click (mobile)
  const handleSearchIconClick = () => {
    setIsExpanded(!isExpanded);
    // Focus input when expanding
    if (!isExpanded) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setSearchQuery("");
      setShowSuggestions(false);
    }
  };

  // Handle input change
  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
  };

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && filteredTeams.length > 0) {
      handleTeamClick(filteredTeams[0]);
    }
  };

  return (
    <div className={`team-search ${isExpanded ? "expanded" : ""}`} ref={searchRef}>
      {/* Search icon for mobile */}
      <button
        className="team-search-icon"
        onClick={handleSearchIconClick}
        aria-label="Search teams"
      >
        <img src={searchIcon} alt="Search" />
      </button>

      {/* Search input */}
      <div className="team-search-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          className="team-search-input"
          placeholder="Search teams..."
          value={searchQuery}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => searchQuery && setShowSuggestions(true)}
        />
        <img src={searchIcon} alt="" className="team-search-input-icon" />
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && (
        <div className="team-search-suggestions">
          {loading ? (
            <div className="team-search-suggestion loading">
              Loading teams...
            </div>
          ) : filteredTeams.length > 0 ? (
            filteredTeams.map((team) => (
              <div
                key={team.slug || team._id}
                className="team-search-suggestion"
                onClick={() => handleTeamClick(team)}
              >
                {team.image_path && (
                  <img
                    src={team.image_path}
                    alt={team.name}
                    className="team-search-suggestion-logo"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                )}
                <span className="team-search-suggestion-name">{team.name}</span>
              </div>
            ))
          ) : (
            <div className="team-search-suggestion no-results">
              No teams found
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamSearch;
