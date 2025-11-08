// src/components/Auth/AuthButtons.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import AuthModal from './AuthModal';
import UserMenu from './UserMenu';
import './AuthButtons.css';

const AuthButtons = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('login');
  const { isAuthenticated, loading } = useAuth();

  const openLoginModal = () => {
    setModalMode('login');
    setIsModalOpen(true);
  };

  const openRegisterModal = () => {
    setModalMode('register');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  if (loading) {
    return (
      <div className="auth-buttons">
        <div className="auth-loading">Loading...</div>
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div className="auth-buttons">
        <UserMenu />
      </div>
    );
  }

  return (
    <>
      <div className="auth-buttons">
        <button 
          className="auth-btn auth-btn-secondary"
          onClick={openLoginModal}
        >
          Sign In
        </button>
        <button 
          className="auth-btn auth-btn-primary"
          onClick={openRegisterModal}
        >
          Sign Up
        </button>
      </div>

      <AuthModal 
        isOpen={isModalOpen}
        onClose={closeModal}
        initialMode={modalMode}
      />
    </>
  );
};

export default AuthButtons;