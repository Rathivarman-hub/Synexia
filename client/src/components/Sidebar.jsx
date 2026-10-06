import React from 'react';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiHome, FiUser, FiUsers } from 'react-icons/fi';
import logo from '../assets/1logo.png';
import './Sidebar.css';

const Sidebar = () => {
  const { user } = useAuth();
  const location = useLocation();

  const adminLinks = [
    { to: '/admin', label: 'Dashboard', icon: FiHome },
    { to: '/admin/students', label: 'Students', icon: FiUsers },
    { to: '/admin/profile', label: 'Profile', icon: FiUser },
  ];

  const studentLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: FiHome },
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
