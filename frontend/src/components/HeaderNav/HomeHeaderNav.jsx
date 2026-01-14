import React, { useState, useEffect, useRef } from "react";
import "./homeHeaderNav.css";

import calendar from "../../assets/images/calendar-regular-full.svg";

// temporary imports

import premierleague from "../../assets/images/epl-logo.svg";
import bundesliga from "../../assets/images/bundesliga-logo.svg";
import laliga from "../../assets/images/laliga-logo.svg";

const HomeHeaderNav = ({ selectedDate, onDateSelect, availableLeagues = [], selectedLeague = 'all', onLeagueSelect }) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const dateInputRef = useRef(null);
  
  // Handle league selection
  const handleLeagueClick = (leagueId) => {
    console.log('🏆 HeaderNav: League clicked:', leagueId);
    if (onLeagueSelect) {
      onLeagueSelect(leagueId);
    }
  };
  
  // Generate 7 days around today (3 before, today, 3 after)
  const generateDates = () => {
    const dates = [];
    const today = new Date();
    
    for (let i = -3; i <= 3; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      dates.push(date);
    }
    
    return dates;
  };
  
  const formatDay = (date) => {
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
  };
  
  const formatDate = (date) => {
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return 'TODAY';
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  };
  
  const isSelectedDate = (date) => {
    const result = selectedDate && date.toDateString() === selectedDate.toDateString();
    return result;
  };
  
  // Handle calendar icon click - show modal
  const handleCalendarClick = () => {
    setShowDatePicker(true);
  };
  
  // Automatically open native date picker when modal appears
  useEffect(() => {
    if (showDatePicker && dateInputRef.current) {
      // Small delay to ensure modal is rendered
      setTimeout(() => {
        if (dateInputRef.current) {
          try {
            // Try showPicker first for modern browsers
            if (typeof dateInputRef.current.showPicker === 'function') {
              dateInputRef.current.showPicker();
            } else {
              // Fallback for older browsers
              dateInputRef.current.click();
            }
          } catch (error) {
            // If showPicker fails, try click as fallback
            dateInputRef.current.click();
          }
        }
      }, 100);
    }
  }, [showDatePicker]);
  
  // Handle date selection from modal
  const handleDateChange = (event) => {
    const dateValue = event.target.value;
    if (dateValue && onDateSelect) {
      const selectedDateObj = new Date(dateValue);
      onDateSelect(selectedDateObj);
      setShowDatePicker(false);
    }
  };
  
  // Format date for HTML input (YYYY-MM-DD)
  const formatDateForInput = (date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };
  
  const dates = generateDates();
  
  return (
    <div className="home-header-nav">
      {/* <div>
          <ul className='fixture-type-selector'>
            <li>All</li>
            <li>LIVE</li>
            <li>Upcoming</li>
            <li>Completed</li>
          </ul>
        </div>
        <div className='header-icon-container'>
          <ul>
            <li><img className="header-icon" src={calendar} alt="" /></li>
            <li><img className="header-icon" src={sort} alt="" /></li>
            <li><img className="header-icon" src={search} alt="" /></li>
          </ul>
        </div> */}
      <div className="home-header-nav-container">
        <div>
          <ul className="league-selector">
            {/* View All option - for filtering all leagues */}
            <li 
              className={selectedLeague === 'all' ? 'selected' : ''}
              onClick={() => handleLeagueClick('all')}
              style={{ cursor: 'pointer' }}
            >
              <div>
                <img className="league-badge" src={bundesliga} alt="" />
                <p className="league-name">View All</p>
              </div>
            </li>
            
            {/* Dynamic league options */}
            {(() => {
              // Filter out null/undefined leagues and leagues without names
              const validLeagues = availableLeagues.filter(league => 
                league && 
                league.id != null && 
                league.name && 
                league.name.trim() !== '' &&
                league.name.toLowerCase() !== 'null'
              );
              
              // Define popular league IDs and their priority order
              const popularLeagueIds = {
                8: 1,    // Premier League (England)
                564: 2,  // La Liga (Spain) 
                82: 3,   // Bundesliga (Germany)
                2: 4,    // Serie A (Italy)
                301: 5,  // Ligue 1 (France)
                9: 6,    // Championship (England)
                // Add more as needed
              };
              
              // Sort leagues: popular leagues first, then alphabetically
              const sortedLeagues = validLeagues.sort((a, b) => {
                const aPriority = popularLeagueIds[parseInt(a.id)] || 999;
                const bPriority = popularLeagueIds[parseInt(b.id)] || 999;
                
                // If both have same priority (both popular or both not popular)
                if (aPriority === bPriority) {
                  return a.name.localeCompare(b.name); // Sort alphabetically
                }
                
                return aPriority - bPriority; // Sort by priority
              });
              
              // Limit to first 8 leagues (since we have View All first)
              const limitedLeagues = sortedLeagues.slice(0, 8);
              
              // Map league IDs to appropriate logos
              const getLeagueLogo = (leagueId) => {
                switch (parseInt(leagueId)) {
                  case 8: return premierleague; // Premier League
                  case 9: return premierleague; // Championship (using PL logo as placeholder)
                  case 564: return laliga; // La Liga
                  case 82: return bundesliga; // Bundesliga
                  case 2: return premierleague; // Serie A (using PL logo as placeholder)
                  case 301: return laliga; // Ligue 1 (using La Liga logo as placeholder)
                  default: return bundesliga; // Default logo
                }
              };
              
              const leagueItems = limitedLeagues.map((league) => (
                <li 
                  key={league.id}
                  className={String(selectedLeague) === String(league.id) ? 'selected' : ''}
                  onClick={() => handleLeagueClick(String(league.id))}
                  style={{ cursor: 'pointer' }}
                >
                  <div>
                    <img 
                      className="league-badge" 
                      src={getLeagueLogo(league.id)} 
                      alt={league.name} 
                    />
                    <p className="league-name">{league.name}</p>
                  </div>
                </li>
              ));
              
              // Add "All Fixtures" as the final option - redirects to fixtures page
              leagueItems.push(
                <li 
                  key="all-fixtures"
                  onClick={() => {
                    // Navigate to fixtures page - adjust path as needed
                    window.location.href = '/fixtures';
                  }}
                  style={{ cursor: 'pointer' }}
                  className="fixtures-link"
                >
                  <div>
                    <img className="league-badge" src={calendar} alt="" />
                    <p className="league-name">All Fixtures</p>
                  </div>
                </li>
              );
              
              return leagueItems;
            })()}
          </ul>
        </div>
        <div className="day-selector-container">
          <ul className="day-selector">
            {dates.map((date, index) => {
              const isSelected = isSelectedDate(date);
              return (
                <li 
                  key={index}
                  className={isSelected ? 'selected' : ''}
                  onClick={() => {
                    console.log('📅 Date selected:', date.toDateString());
                    if (onDateSelect) {
                      onDateSelect(date);
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <div>
                    <p className="day">{formatDay(date)}</p>
                    <p className="date">{formatDate(date)}</p>
                  </div>
                </li>
              );
            })}
            <li className="home-header-icon" onClick={handleCalendarClick}>
              <img src={calendar} alt="Select date" style={{ cursor: 'pointer' }} title="Select a specific date" />
            </li>
          </ul>
        </div>
      </div>
      
      {/* Simple Date Picker Modal */}
      {showDatePicker && (
        <div className="date-picker-overlay" onClick={(e) => e.target.className === 'date-picker-overlay' && setShowDatePicker(false)}>
          <div className="date-picker-modal">
            <div className="date-picker-header">
              <h3>Select Date</h3>
              <button onClick={() => setShowDatePicker(false)} className="close-button">×</button>
            </div>
            <div className="date-picker-content">
              <input
                ref={dateInputRef}
                type="date"
                value={formatDateForInput(selectedDate)}
                onChange={handleDateChange}
                className="date-input"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HomeHeaderNav;
