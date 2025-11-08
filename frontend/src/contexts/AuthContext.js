// src/contexts/AuthContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import * as authAPI from '../api/auth';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check if user is logged in on app start
  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      console.log('🔍 Checking auth status...');
      const userData = await authAPI.getCurrentUser();
      console.log('📋 Auth check response:', userData);
      if (userData && userData.data && userData.data.user) {
        console.log('✅ User authenticated:', userData.data.user.email);
        setUser(userData.data.user);
        setIsAuthenticated(true);
      } else {
        console.log('❌ No user data found');
        setUser(null);
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error('❌ Auth check failed:', error);
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      if (response && response.data && response.data.user) {
        setUser(response.data.user);
        setIsAuthenticated(true);
        
        // Store token in localStorage as backup
        if (response.token) {
          localStorage.setItem('authToken', response.token);
          console.log('🔐 Token stored in localStorage');
        }
        
        return { success: true, user: response.data.user };
      }
      throw new Error('Invalid response format');
    } catch (error) {
      console.error('Login failed:', error);
      return { 
        success: false, 
        error: error.body?.message || error.message || 'Login failed' 
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      if (response && response.data && response.data.user) {
        setUser(response.data.user);
        setIsAuthenticated(true);
        
        // Store token in localStorage as backup
        if (response.token) {
          localStorage.setItem('authToken', response.token);
          console.log('🔐 Token stored in localStorage');
        }
        
        return { success: true, user: response.data.user };
      }
      throw new Error('Invalid response format');
    } catch (error) {
      console.error('Registration failed:', error);
      return { 
        success: false, 
        error: error.body?.message || error.message || 'Registration failed' 
      };
    }
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Clear token from localStorage
      localStorage.removeItem('authToken');
      console.log('🗑️ Token removed from localStorage');
      setUser(null);
      setIsAuthenticated(false);
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await authAPI.updateProfile(profileData);
      if (response && response.data && response.data.user) {
        setUser(response.data.user);
        return { success: true, user: response.data.user };
      }
      throw new Error('Invalid response format');
    } catch (error) {
      console.error('Profile update failed:', error);
      return { 
        success: false, 
        error: error.body?.message || error.message || 'Profile update failed' 
      };
    }
  };

  const value = {
    user,
    isAuthenticated,
    loading,
    login,
    register,
    logout,
    updateProfile,
    checkAuthStatus
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;