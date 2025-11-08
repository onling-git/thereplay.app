// src/components/Auth/UserMenu.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './UserMenu.css';

const UserMenu = () => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const { user, logout, isAuthenticated } = useAuth();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsOpen(false);
  };

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <div className="user-menu" ref={menuRef}>
      <button 
        className="user-menu-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        <div className="user-avatar">
          {user.avatar_url ? (
            <img src={user.avatar_url} alt="Profile" />
          ) : (
            <span>{user.first_name?.[0]}{user.surname?.[0]}</span>
          )}
        </div>
        <span className="user-name">{user.first_name} {user.surname}</span>
        <svg 
          className={`chevron ${isOpen ? 'rotated' : ''}`} 
          width="16" 
          height="16" 
          viewBox="0 0 16 16"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      </button>

      {isOpen && (
        <div className="user-menu-dropdown">
          <div className="user-menu-header">
            <div className="user-info">
              <div className="user-name-full">{user.display_name || user.full_name}</div>
              <div className="user-email">{user.email}</div>
              {user.subscription && (
                <div className="user-plan">
                  {user.subscription.plan.charAt(0).toUpperCase() + user.subscription.plan.slice(1)} Plan
                </div>
              )}
            </div>
          </div>
          
          <div className="user-menu-section">
            <a href="/account" className="user-menu-item">
              <span>Account Settings</span>
            </a>
            <a href="/account/preferences" className="user-menu-item">
              <span>Preferences</span>
            </a>
            <a href="/account/subscription" className="user-menu-item">
              <span>Subscription</span>
            </a>
          </div>

          <div className="user-menu-section">
            <button 
              className="user-menu-item logout-btn"
              onClick={handleLogout}
            >
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserMenu;