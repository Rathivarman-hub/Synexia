import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiCode, FiAward, FiUser, FiSettings, FiUsers } from 'react-icons/fi';
import logo from '../assets/1logo.png';
import './Sidebar.css';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  const adminLinks = [
    { to: '/admin', label: 'Dashboard', icon: FiHome },
    { to: '/admin/coding-problems', label: 'Coding Questions', icon: FiCode },
    { to: '/admin/debugging-problems', label: 'Debugging Questions', icon: FiCode },
    { to: '/admin/students', label: 'Students', icon: FiUsers },
    { to: '/leaderboard', label: 'Leaderboard', icon: FiAward },
    { to: '/admin/profile', label: 'Profile', icon: FiUser },
  ];

  const studentLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: FiHome },
    { to: '/coding/problems', label: 'Coding Problems', icon: FiCode },
    { to: '/debugging/problems', label: 'Debugging Assessment', icon: FiCode },
    { to: '/profile', label: 'Profile', icon: FiUser },
  ];

  const links = user?.role === 'admin' ? adminLinks : studentLinks;

  const isActive = (to) => {
    if (location.pathname === to) return true;
    if (to !== '/dashboard' && to !== '/admin' && location.pathname.startsWith(to)) return true;
    return false;
  };

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <Link to="/">
          <img src={logo} alt="SYNEXIA" className="sidebar-logo" />
        </Link>
      </div>

      <nav className="sidebar-nav">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`sidebar-link ${isActive(link.to) ? 'active' : ''}`}
            >
              <Icon className="sidebar-icon" />
              <span className="sidebar-label">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default Sidebar;
