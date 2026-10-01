import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiSearch, FiLogOut } from 'react-icons/fi';
import './Header.css';

const Header = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="header-spacer"></div>
      <div className="header-actions">
        <div className="header-search">
          <FiSearch className="search-icon" />
          <input 
            type="text" 
            placeholder="Search problems..." 
            className="search-input" 
          />
        </div>

        <div className="user-profile">
          <div className="user-avatar">
            {user?.avatar ? (
              <img src={user.avatar} alt="Profile" />
            ) : (
              user?.name?.charAt(0).toUpperCase() || 'U'
            )}
          </div>
          <span className="user-name">{user?.name?.split(' ')[0] || 'User'}</span>
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Logout">
          <FiLogOut />
        </button>
      </div>
    </header>
  );
};

export default Header;
