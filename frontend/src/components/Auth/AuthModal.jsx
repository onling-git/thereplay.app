// src/components/Auth/AuthModal.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import { triggerTeamOnboarding } from '../../hooks/useTeamOnboarding';
import './AuthModal.css';

const AuthModal = ({ isOpen, onClose, initialMode = 'login' }) => {
  const [mode, setMode] = useState(initialMode); // 'login' or 'register'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    first_name: '',
    surname: '',
    terms_accepted: false
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const { login, register } = useAuth();

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }

    if (mode === 'register') {
      if (!formData.first_name) {
        newErrors.first_name = 'First name is required';
      }
      if (!formData.surname) {
        newErrors.surname = 'Surname is required';
      }
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm your password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
      if (!formData.terms_accepted) {
        newErrors.terms_accepted = 'You must accept the terms and conditions';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      let result;
      
      if (mode === 'login') {
        result = await login(formData.email, formData.password);
      } else {
        result = await register({
          email: formData.email,
          password: formData.password,
          first_name: formData.first_name,
          surname: formData.surname,
          terms_accepted: formData.terms_accepted
        });
      }

      if (result.success) {
        setMessage(mode === 'login' ? 'Login successful!' : 'Registration successful!');
        setTimeout(() => {
          onClose();
          
          // Trigger onboarding for new registrations
          if (mode === 'register') {
            triggerTeamOnboarding();
          }
          
          // Reset form
          setFormData({
            email: '',
            password: '',
            confirmPassword: '',
            first_name: '',
            surname: '',
            terms_accepted: false
          });
          setMessage('');
        }, 1000);
      } else {
        setMessage(result.error || 'An error occurred');
      }
    } catch (error) {
      setMessage('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setErrors({});
    setMessage('');
  };

  if (!isOpen) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={e => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
          <button className="auth-modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <>
              <div className="form-group">
                <label htmlFor="first_name">First Name</label>
                <input
                  id="first_name"
                  name="first_name"
                  type="text"
                  value={formData.first_name}
                  onChange={handleInputChange}
                  className={errors.first_name ? 'error' : ''}
                  disabled={loading}
                />
                {errors.first_name && <span className="error-message">{errors.first_name}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="surname">Surname</label>
                <input
                  id="surname"
                  name="surname"
                  type="text"
                  value={formData.surname}
                  onChange={handleInputChange}
                  className={errors.surname ? 'error' : ''}
                  disabled={loading}
                />
                {errors.surname && <span className="error-message">{errors.surname}</span>}
              </div>
            </>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              className={errors.email ? 'error' : ''}
              disabled={loading}
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleInputChange}
              className={errors.password ? 'error' : ''}
              disabled={loading}
            />
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>

          {mode === 'register' && (
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={errors.confirmPassword ? 'error' : ''}
                disabled={loading}
              />
              {errors.confirmPassword && <span className="error-message">{errors.confirmPassword}</span>}
            </div>
          )}

          {mode === 'register' && (
            <div className="form-group checkbox-group">
              <label className="checkbox-label">
                <input
                  name="terms_accepted"
                  type="checkbox"
                  checked={formData.terms_accepted}
                  onChange={handleInputChange}
                  disabled={loading}
                />
                I accept the <a href="/terms" target="_blank">Terms and Conditions</a>
              </label>
              {errors.terms_accepted && <span className="error-message">{errors.terms_accepted}</span>}
            </div>
          )}

          {message && (
            <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>
              {message}
            </div>
          )}

          <button 
            type="submit" 
            className="auth-submit-btn" 
            disabled={loading}
          >
            {loading ? 'Please wait...' : (mode === 'login' ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="auth-switch">
          {mode === 'login' ? (
            <p>
              Don't have an account?{' '}
              <button type="button" className="link-button" onClick={switchMode}>
                Sign up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button type="button" className="link-button" onClick={switchMode}>
                Sign in
              </button>
            </p>
          )}
        </div>

        <div className="auth-guest-notice">
          <p>
            <strong>Note:</strong> You can use this site without creating an account! 
            Registration is optional but allows you to save your preferences and access premium features.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;