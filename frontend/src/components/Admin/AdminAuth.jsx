// components/Admin/AdminAuth.jsx
import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import './AdminAuth.css';

const AdminAuth = ({ onAuthenticated }) => {
  const { login, user, isAuthenticated } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if current user has admin privileges
  React.useEffect(() => {
    if (isAuthenticated && user && ['admin', 'super_admin'].includes(user.role)) {
      onAuthenticated(user);
    }
  }, [isAuthenticated, user, onAuthenticated]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = await login(formData.email, formData.password);
      
      if (result.success) {
        // Check if user has admin privileges
        if (['admin', 'super_admin'].includes(result.user.role)) {
          sessionStorage.setItem('admin_authenticated', 'true');
          onAuthenticated(result.user);
        } else {
          setError('Insufficient privileges. Admin access required.');
        }
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      setError('Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth">
      <div className="admin-auth-modal">
        <h2>Admin Access Required</h2>
        <p>Please login with your admin credentials to access the admin panel.</p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="email">Email:</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="Enter admin email"
              required
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Enter password"
              required
              disabled={loading}
            />
          </div>
          
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={loading || !formData.email.trim() || !formData.password.trim()}
            className="auth-button"
          >
            {loading ? 'Authenticating...' : 'Admin Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminAuth;