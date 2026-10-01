import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Navbar, Nav, Container, Button } from 'react-bootstrap';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import logo from '../assets/1logo.png';

const TechizNavbar = () => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [expanded, setExpanded] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const navItems = user?.role === 'admin'
    ? [
        { to: '/admin', label: 'Dashboard' },
        { to: '/admin/coding-problems', label: 'Problems' },
        { to: '/admin/students', label: 'Students' },
        { to: '/admin/profile', label: 'Profile' },
        { to: '/leaderboard', label: 'Leaderboard' },
      ]
    : user
    ? [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/coding/problems', label: 'Coding Problems' },
        { to: '/profile', label: 'Profile' },
      ]
    : [
        { to: '/', label: 'Home' },
      ];

  // WHY the longest-prefix rule and not a plain `startsWith`: with plain
  // startsWith, "/admin/coding-problems" would light up BOTH "Dashboard" (/admin)
  // and "Problems". Taking the LONGEST matching prefix makes exactly one item
  // active, while still keeping a section lit while you are inside it
  // (e.g. "Practice" stays active on /coding/problems/:slug).
  const isActive = (to) => {
    if (location.pathname === to) return true;
    if (!location.pathname.startsWith(`${to}/`)) return false;
    const deeper = navItems.some((other) => other.to !== to && location.pathname.startsWith(`${other.to}/`));
    return !deeper;
  };

  return (
    <Navbar expand="lg" className="techiz-navbar" expanded={expanded}>
      <Container>
        <Navbar.Brand as={Link} to="/" className="navbar-brand">
          <img className="brand-mark" src={logo} alt="SYNEXIA" />
        </Navbar.Brand>
        <Navbar.Toggle
          aria-controls="techiz-nav"
          onClick={() => setExpanded(!expanded)}
        />
        <Navbar.Collapse id="techiz-nav">
          <Nav className="me-auto navbar-links">
            {navItems.map((item) => (
              <Nav.Link
                key={item.to}
                as={Link}
                to={item.to}
                className={isActive(item.to) ? 'active' : ''}
                onClick={() => setExpanded(false)}
              >
                {item.label}
              </Nav.Link>
            ))}
          </Nav>
          <Nav className="align-items-center navbar-actions">
            {user ? (
              <>
                <div className="navbar-user-avatar" aria-label="Profile photo">
                  {user.avatar ? <img src={user.avatar} alt="" /> : user.name?.charAt(0).toUpperCase()}
                </div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Hi, {user.name?.split(' ')[0]}
                </span>
                <button className="btn-techiz" onClick={handleLogout} style={{ padding: '6px 18px', fontSize: '0.85rem' }}>
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="btn-outline-techiz" style={{ padding: '6px 18px', fontSize: '0.85rem' }}>
                  Login
                </Link>
                <Link to="/register" className="btn-techiz" style={{ padding: '6px 18px', fontSize: '0.85rem' }}>
                  Register
                </Link>
              </>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default TechizNavbar;
